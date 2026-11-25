import express from 'express';
import crypto from 'crypto';
import {
  ensurePayrollIntegrity,
  evaluateCommissionsForEvent,
  getUserDisplayName,
  reverseCommissionsForAnnulledPayment,
} from '../../src/db/payrollEngine.ts';
import {
  actorHasDynamicPermission,
  CLINICAL_ACCESS_ROLES,
  getServerDbState,
  saveDatabaseStateStrict,
  TenantActorContext,
  withOrgTransactionLock,
} from '../stateStore.ts';
import { authenticateServerRequest, denyIfModuleNotAllowed } from '../security.ts';
import { getTodayAsuncionISO } from '../../src/config/appBrand.ts';
import { formatProfessionalName } from '../../src/utils/healthProfessional.ts';

function normalizeTimeStr(val: string): string {
  const s = String(val || '').trim();
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return '';
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function addMinutesToTime(startTime: string, durationMin: number): string {
  const totalMin = timeToMinutes(startTime) + durationMin;
  if (totalMin >= 24 * 60) {
    return '23:59:00';
  }
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

function updatePatientBranchVisitDates(
  patientBranches: any[],
  patientId: string,
  branchId: string,
  visitDate: string
) {
  const existing = patientBranches.find(
    (pb: any) => pb.patientId === patientId && pb.branchId === branchId
  );
  if (existing) {
    if (!existing.firstVisitDate || visitDate < existing.firstVisitDate) {
      existing.firstVisitDate = visitDate;
    }
    if (!existing.lastVisitDate || visitDate > existing.lastVisitDate) {
      existing.lastVisitDate = visitDate;
    }
    return existing;
  }
  const created = {
    patientId,
    branchId,
    firstVisitDate: visitDate,
    lastVisitDate: visitDate,
  };
  patientBranches.push(created);
  return created;
}

function getNextReceiptNumberForOrg(data: any, orgId: string): string {
  const existingPayments = (data.payments || []).filter((p: any) => p.organizationId === orgId);
  let maxSequential = 4120;
  for (const p of existingPayments) {
    if (p.receiptNumber) {
      const match = String(p.receiptNumber).match(/REC-\d{3}-\d{3}-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxSequential) {
          maxSequential = num;
        }
      }
    }
  }
  return `REC-001-001-${String(maxSequential + 1).padStart(7, '0')}`;
}

function getNextInvoiceNumberForOrg(data: any, orgId: string): string {
  const existingPayments = (data.payments || []).filter((p: any) => p.organizationId === orgId);
  let maxInvoice = 100000;
  for (const p of existingPayments) {
    if (p.invoiceNumber) {
      const match = String(p.invoiceNumber).match(/001-001-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxInvoice) {
          maxInvoice = num;
        }
      }
    }
  }
  return `001-001-${String(maxInvoice + 1).padStart(7, '0')}`;
}

function canActorAccessBranch(
  actor: TenantActorContext,
  branchId: string,
  orgWidePermissions: string[],
  roles: any[]
): boolean {
  if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN_ORGANIZACION') return true;
  if (actor.role === 'ADMIN_SUCURSAL') {
    return actor.allowedBranchIds.length === 0 || actor.allowedBranchIds.includes(branchId);
  }
  const hasOrgWidePerm = orgWidePermissions.some((p) => actorHasDynamicPermission(actor, p, roles));
  if (hasOrgWidePerm && actor.allowedBranchIds.length === 0) return true;
  if (actor.allowedBranchIds.length > 0) {
    return actor.allowedBranchIds.includes(branchId);
  }
  return true;
}

function captureCollectionsSnapshot(data: any, collections: string[]): Map<string, any[]> {
  const snap = new Map<string, any[]>();
  for (const col of collections) {
    const arr = Array.isArray(data[col]) ? data[col] : [];
    snap.set(
      col,
      arr.map((row: any) => (row && typeof row === 'object' ? structuredClone(row) : row))
    );
  }
  return snap;
}

function restoreCollectionsSnapshot(data: any, snap: Map<string, any[]>): void {
  for (const [col, arr] of snap.entries()) {
    data[col] = arr;
  }
}

export function createClinicalBillingRouter(): express.Router {
  const router = express.Router();

  // =========================================================================
  // 1. AGENDA Y CITAS (TRANSACCIONAL + ANTI-DOUBLE BOOKING EN SERVIDOR)
  // =========================================================================

  router.post('/appointments', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'agenda', 'POST /api/appointments')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const hasAppointmentPerm =
        actorHasDynamicPermission(auth.actor, 'appointments.manage', roles) ||
        actorHasDynamicPermission(auth.actor, 'appointments.manage_own_branch', roles) ||
        actorHasDynamicPermission(auth.actor, 'appointments.checkin', roles) ||
        actorHasDynamicPermission(auth.actor, 'clinical.manage', roles);

      if (!hasAppointmentPerm) {
        return res.status(403).json({
          error: '403 Prohibido: No posee permisos para agendar turnos clínicos.',
        });
      }

      const body = req.body || {};
      const branchId = String(body.branchId || '').trim();
      const patientId = String(body.patientId || '').trim();
      const odontologistId = String(body.odontologistId || '').trim();
      const serviceId = body.serviceId ? String(body.serviceId).trim() : null;
      const dentalChairIdInput = body.dentalChairId ? String(body.dentalChairId).trim() : null;
      const appointmentDate = String(body.appointmentDate || '').trim();
      const startTime = normalizeTimeStr(String(body.startTime || ''));
      const durationMin = Math.max(5, Number(body.durationMin) || 30);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
        return res.status(400).json({
          error: 'La fecha de la cita debe tener formato válido (AAAA-MM-DD).',
        });
      }
      if (!body.endTime && startTime && timeToMinutes(startTime) + durationMin > 23 * 60 + 59) {
        return res.status(400).json({
          error: 'El horario de la cita supera el cierre del día (23:59). Ajuste la hora de inicio o la duración.',
        });
      }
      const endTime = body.endTime ? normalizeTimeStr(String(body.endTime)) : addMinutesToTime(startTime, durationMin);

      if (!branchId || !patientId || !odontologistId || !appointmentDate || !startTime || !endTime) {
        return res.status(400).json({
          error: 'Sucursal, paciente, odontólogo, fecha y horario de inicio/fin son obligatorios.',
        });
      }
      if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
        return res.status(400).json({
          error: 'La hora de finalización debe ser posterior a la hora de inicio.',
        });
      }

      const preBranch = (initialData.branches || []).find((b: any) => b.id === branchId);
      if (!preBranch) {
        return res.status(404).json({ error: 'Sucursal no encontrada.' });
      }
      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preBranch.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preBranch.organizationId !== orgId) {
        return res.status(403).json({
          error: '403 Prohibido: Violación de aislamiento multiempresa en sucursal.',
        });
      }
      if (!canActorAccessBranch(auth.actor, branchId, ['appointments.manage'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No tiene autorización para agendar turnos en esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        if (!Array.isArray(data.appointments)) data.appointments = [];
        if (!Array.isArray(data.patientBranches)) data.patientBranches = [];
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const patient = (data.patients || []).find((p: any) => p.id === patientId);
        if (!patient) return res.status(404).json({ error: 'Paciente no encontrado.' });
        if (patient.organizationId !== orgId) {
          return res.status(403).json({ error: '403 Prohibido: Paciente pertenece a otra organización.' });
        }

        const doctor = (data.users || []).find((u: any) => u.id === odontologistId);
        if (!doctor) return res.status(404).json({ error: 'Odontólogo no encontrado.' });
        if (doctor.organizationId !== orgId) {
          return res.status(403).json({ error: '403 Prohibido: Profesional pertenece a otra organización.' });
        }

        let dentalChairId = dentalChairIdInput;
        const branchChairs = (data.dentalChairs || []).filter(
          (c: any) => c.organizationId === orgId && c.branchId === branchId && c.status !== 'INACTIVE'
        );

        if (dentalChairId) {
          const chair = (data.dentalChairs || []).find((c: any) => c.id === dentalChairId);
          if (!chair || chair.organizationId !== orgId || chair.branchId !== branchId) {
            return res.status(400).json({ error: 'El sillón dental no pertenece a la sucursal indicada.' });
          }
        }

        const settings = (data.branchSettings || []).find((bs: any) => bs.branchId === branchId);
        const newStart = timeToMinutes(startTime);
        const newEnd = timeToMinutes(endTime);

        if (!dentalChairId && branchChairs.length > 0) {
          const occupiedChairIds = new Set<string>();
          for (const existing of data.appointments) {
            if (existing.branchId !== branchId) continue;
            if (existing.appointmentDate !== appointmentDate) continue;
            if (existing.status === 'CANCELADA' || existing.status === 'NO_ASISTIO') continue;
            if (!existing.dentalChairId) continue;
            const exStart = timeToMinutes(normalizeTimeStr(existing.startTime));
            const exEnd = timeToMinutes(normalizeTimeStr(existing.endTime));
            if (newStart < exEnd && newEnd > exStart) {
              occupiedChairIds.add(existing.dentalChairId);
            }
          }
          const freeChair = branchChairs.find((c: any) => !occupiedChairIds.has(c.id));
          dentalChairId = freeChair ? freeChair.id : branchChairs[0].id;
        }

        if (!settings?.allowDoubleBooking) {
          for (const existing of data.appointments) {
            if (existing.branchId !== branchId) continue;
            if (existing.appointmentDate !== appointmentDate) continue;
            if (existing.status === 'CANCELADA' || existing.status === 'NO_ASISTIO') continue;

            const exStart = timeToMinutes(normalizeTimeStr(existing.startTime));
            const exEnd = timeToMinutes(normalizeTimeStr(existing.endTime));
            if (newStart < exEnd && newEnd > exStart) {
              if (existing.odontologistId === odontologistId) {
                return res.status(409).json({
                  error: `Conflicto de agenda: ${formatProfessionalName(doctor, { fallback: 'El profesional' })} ya tiene una cita de ${String(existing.startTime).slice(0, 5)} a ${String(existing.endTime).slice(0, 5)}.`,
                  code: 'CONFLICT_DOUBLE_BOOKING_DOCTOR',
                });
              }
              if (dentalChairId && existing.dentalChairId && existing.dentalChairId === dentalChairId) {
                const chair = (data.dentalChairs || []).find((c: any) => c.id === dentalChairId);
                return res.status(409).json({
                  error: `Conflicto de sillón: El ${chair?.name || 'Sillón seleccionado'} ya está ocupado de ${String(existing.startTime).slice(0, 5)} a ${String(existing.endTime).slice(0, 5)}.`,
                  code: 'CONFLICT_DOUBLE_BOOKING_CHAIR',
                });
              }
            }
          }
        }

        const rollbackSnap = captureCollectionsSnapshot(data, ['appointments', 'patientBranches', 'auditLogs']);
        try {
          const nowIso = new Date().toISOString();
          const appointmentId = crypto.randomUUID();
          const record = {
            id: appointmentId,
            organizationId: orgId,
            branchId,
            dentalChairId,
            patientId,
            odontologistId,
            serviceId,
            appointmentDate,
            startTime,
            endTime,
            durationMin,
            status: 'PENDIENTE',
            reason: String(body.reason || 'Consulta clínica dental programada').trim(),
            notes: String(body.notes || 'Turno registrado vía servidor transaccional.').trim(),
            createdBy: auth.user!.id,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          data.appointments.unshift(record);

          const visitDateStr = appointmentDate || getTodayAsuncionISO();
          const patientBranch = updatePatientBranchVisitDates(
            data.patientBranches,
            patientId,
            branchId,
            visitDateStr
          );

          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId,
            userId: auth.user!.id,
            action: 'CREATE',
            entity: 'APPOINTMENT',
            entityId: appointmentId,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend API',
            oldValues: null,
            newValues: record,
            description: `Agendamiento de turno odontológico para fecha ${appointmentDate} a las ${startTime.slice(0, 5)} hs (Zona America/Asuncion)`,
            createdAt: nowIso,
          };
          data.auditLogs.unshift(auditLog);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              appointments: [record],
              patientBranches: [patientBranch],
              auditLogs: [auditLog],
            },
          });

          return res.status(201).json({
            appointment: record,
            patientBranch,
            auditLogs: [auditLog],
            stateVersion,
          });
        } catch (err: any) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // 2. COBROS SOBRE TRATAMIENTO (ATÓMICO: PAGO + SALDO + CAJA + COMISIONES)
  // =========================================================================

  router.post('/treatments/:id/payments', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, ['cash', 'treatments'], 'POST /api/treatments/:id/payments')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canCreatePayment =
        actorHasDynamicPermission(auth.actor, 'payments.create', roles) ||
        actorHasDynamicPermission(auth.actor, 'cash.movement', roles) ||
        actorHasDynamicPermission(auth.actor, 'cash.manage_own_branch', roles);

      if (!canCreatePayment) {
        return res.status(403).json({
          error: '403 Prohibido: Su rol no tiene autorización para registrar cobros.',
        });
      }

      const treatmentId = String(req.params.id || '').trim();
      const amount = Number(req.body?.amount);
      const paymentMethod = String(req.body?.paymentMethod || '').trim();
      const requestedReceipt = req.body?.receiptNumber ? String(req.body.receiptNumber).trim() : '';
      const rawPaymentDate = req.body?.paymentDate ? String(req.body.paymentDate).trim() : '';
      const autoProgressIfPaid = Boolean(req.body?.autoProgressIfPaid);

      if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'El monto a abonar en Guaraníes (PYG) debe ser un número entero mayor a ₲ 0.' });
      }
      if (!paymentMethod) {
        return res.status(400).json({ error: 'Debe especificar el medio de cobro.' });
      }
      if (rawPaymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawPaymentDate)) {
        return res.status(400).json({ error: 'La fecha del cobro debe tener formato válido (AAAA-MM-DD).' });
      }

      const preTreat = (initialData.treatments || []).find((t: any) => t.id === treatmentId);
      if (!preTreat) {
        return res.status(404).json({ error: 'El tratamiento especificado no existe.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preTreat.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preTreat.organizationId !== orgId) {
        return res.status(403).json({
          error: '403 Prohibido: Violación de aislamiento multiempresa en tratamiento.',
        });
      }
      if (!canActorAccessBranch(auth.actor, preTreat.branchId, ['payments.create', 'cash.movement'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee acceso para cobrar en esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        ensurePayrollIntegrity(data);
        if (!Array.isArray(data.payments)) data.payments = [];
        if (!Array.isArray(data.cashMovements)) data.cashMovements = [];
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const treat = (data.treatments || []).find((t: any) => t.id === treatmentId && t.organizationId === orgId);
        if (!treat) {
          return res.status(404).json({ error: 'El tratamiento especificado no existe.' });
        }

        const currentBalance = Number(treat.balanceDue ?? Math.max(0, Number(treat.totalAmount || 0) - Number(treat.paidAmount || 0)));
        if (currentBalance <= 0) {
          return res.status(409).json({
            error: 'Este tratamiento ya se encuentra cancelado en su totalidad (saldo pendiente ₲ 0).',
            code: 'CONFLICT_TREATMENT_ALREADY_PAID',
          });
        }
        if (amount > currentBalance) {
          return res.status(409).json({
            error: `El monto (₲ ${amount.toLocaleString('es-PY')}) excede el saldo pendiente actual (₲ ${currentBalance.toLocaleString('es-PY')}).`,
            code: 'CONFLICT_OVERPAYMENT',
            currentBalance,
          });
        }

        const finalReceiptNumber = requestedReceipt || getNextReceiptNumberForOrg(data, orgId);
        const dupReceipt = data.payments.some(
          (p: any) =>
            p.organizationId === orgId &&
            p.status !== 'ANULADO' &&
            String(p.receiptNumber || '').trim() === finalReceiptNumber
        );
        if (dupReceipt) {
          return res.status(409).json({
            error: `El número de recibo ${finalReceiptNumber} ya fue emitido. Utilice el siguiente correlativo.`,
            code: 'CONFLICT_DUPLICATE_RECEIPT',
          });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, [
          'treatments',
          'payments',
          'cashMovements',
          'generatedCommissions',
          'auditLogs',
        ]);

        try {
          const nowIso = new Date().toISOString();
          const todayAsuncion = getTodayAsuncionISO();
          const isHistoricalPayment = Boolean(rawPaymentDate && rawPaymentDate < todayAsuncion);
          const paymentCreatedAtIso = isHistoricalPayment
            ? `${rawPaymentDate}T16:00:00.000Z`
            : nowIso;
          const auditCountBefore = data.auditLogs.length;

          treat.paidAmount = Number(treat.paidAmount || 0) + amount;
          treat.balanceDue = Math.max(0, Number(treat.totalAmount || 0) - treat.paidAmount);
          if (autoProgressIfPaid && treat.balanceDue === 0 && treat.status === 'PLANIFICADO') {
            treat.status = 'EN_PROGRESO';
          }
          treat.updatedAt = nowIso;

          const paymentId = crypto.randomUUID();
          const invoiceNumber = getNextInvoiceNumberForOrg(data, orgId);
          const paymentRecord: any = {
            id: paymentId,
            organizationId: orgId,
            branchId: treat.branchId,
            patientId: treat.patientId,
            treatmentId: treat.id,
            appointmentId: null,
            cashMovementId: null as string | null,
            receiptNumber: finalReceiptNumber,
            invoiceNumber,
            amount,
            paymentMethod,
            status: 'COMPLETADO',
            notes: isHistoricalPayment
              ? `Pago histórico (${rawPaymentDate}) abonado a cuenta del tratamiento ${treat.title}`
              : `Pago abonado a cuenta del tratamiento ${treat.title}`,
            receivedBy: auth.user!.id,
            historicalReceivedByName: getUserDisplayName(auth.user!),
            createdAt: paymentCreatedAtIso,
          };

          data.payments.unshift(paymentRecord);

          let createdMovement: any = null;
          // Los cobros históricos (fecha pasada) actualizan saldo sin distorsionar el cajón de la caja abierta hoy
          if (!isHistoricalPayment) {
            const openRegister = (data.cashRegisters || []).find(
              (cr: any) => cr.organizationId === orgId && cr.branchId === treat.branchId && cr.status === 'ABIERTA'
            );
            if (openRegister) {
              const movementId = crypto.randomUUID();
              createdMovement = {
                id: movementId,
                cashRegisterId: openRegister.id,
                movementType: 'INGRESO',
                amount,
                paymentMethod,
                concept: `Cobro tratamiento ${treat.title} (Recibo ${paymentRecord.receiptNumber})`,
                referenceNumber: paymentRecord.receiptNumber,
                performedBy: auth.user!.id,
                historicalPerformedByName: getUserDisplayName(auth.user!),
                createdAt: nowIso,
              };
              data.cashMovements.unshift(createdMovement);
              paymentRecord.cashMovementId = movementId;
            }
          }

          data.auditLogs.unshift({
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: treat.branchId,
            userId: auth.user!.id,
            action: 'PAYMENT',
            entity: 'TREATMENT',
            entityId: treatmentId,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Financial Engine',
            oldValues: { balanceDue: currentBalance },
            newValues: {
              amount,
              balanceDue: treat.balanceDue,
              receiptNumber: paymentRecord.receiptNumber,
            },
            description: `Cobro de ₲ ${amount.toLocaleString('es-PY')} registrado para tratamiento "${treat.title}" (Recibo: ${paymentRecord.receiptNumber})`,
            createdAt: nowIso,
          });

          const linkedQuote = treat.quoteId ? (data.quotes || []).find((q: any) => q.id === treat.quoteId) : null;
          const generatedCommissions = evaluateCommissionsForEvent(data, {
            eventType: 'PAYMENT_COLLECTED',
            organizationId: orgId,
            branchId: treat.branchId,
            patientId: treat.patientId,
            quoteId: treat.quoteId || null,
            treatmentId: treat.id,
            paymentId: paymentRecord.id,
            odontologistUserId: linkedQuote?.odontologistId || treat.odontologistId || null,
            amount,
            eventDate: rawPaymentDate || todayAsuncion,
            actorUserId: auth.user!.id,
          });

          const newAuditLogs = data.auditLogs.slice(0, data.auditLogs.length - auditCountBefore);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              treatments: [treat],
              payments: [paymentRecord],
              ...(createdMovement ? { cashMovements: [createdMovement] } : {}),
              ...(generatedCommissions.length > 0 ? { generatedCommissions } : {}),
              ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
            },
          });

          return res.status(201).json({
            payment: paymentRecord,
            treatment: treat,
            cashMovement: createdMovement,
            generatedCommissions,
            auditLogs: newAuditLogs,
            stateVersion,
          });
        } catch (err: any) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          if (err?.code === '23505') {
            return res.status(409).json({
              error: 'Conflicto por número de recibo duplicado en base de datos.',
              code: 'CONFLICT_DUPLICATE_RECEIPT',
            });
          }
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // 3. ANULACIÓN ATÓMICA DE RECIBO / PAGO
  // =========================================================================

  router.post('/payments/:id/annul', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'cash', 'POST /api/payments/:id/annul')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canAnnul =
        actorHasDynamicPermission(auth.actor, 'payments.annul', roles) ||
        actorHasDynamicPermission(auth.actor, 'cash.manage_own_branch', roles);

      if (!canAnnul) {
        return res.status(403).json({
          error: '403 Prohibido: No posee permiso para anular recibos oficiales.',
        });
      }

      const paymentId = String(req.params.id || '').trim();
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 5) {
        return res.status(400).json({
          error: 'Debe proporcionar un motivo válido de anulación (mínimo 5 caracteres).',
        });
      }

      const prePayment = (initialData.payments || []).find((p: any) => p.id === paymentId);
      if (!prePayment) {
        return res.status(404).json({ error: 'El recibo / pago no fue encontrado.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(prePayment.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && prePayment.organizationId !== orgId) {
        return res.status(403).json({
          error: '403 Prohibido: Violación de aislamiento multiempresa en recibo.',
        });
      }
      if (!canActorAccessBranch(auth.actor, prePayment.branchId, ['payments.annul'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No tiene autorización para anular recibos de esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        ensurePayrollIntegrity(data);
        if (!Array.isArray(data.cashMovements)) data.cashMovements = [];
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const payment = (data.payments || []).find((p: any) => p.id === paymentId && p.organizationId === orgId);
        if (!payment) {
          return res.status(404).json({ error: 'El recibo / pago no fue encontrado.' });
        }
        if (payment.status === 'ANULADO') {
          return res.status(409).json({
            error: 'Este recibo ya se encuentra anulado.',
            code: 'CONFLICT_PAYMENT_ALREADY_ANNULLED',
          });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, [
          'payments',
          'treatments',
          'cashMovements',
          'generatedCommissions',
          'auditLogs',
        ]);

        try {
          const nowIso = new Date().toISOString();
          const auditCountBefore = data.auditLogs.length;
          const previousStatus = payment.status;

          payment.status = 'ANULADO';
          payment.annulledAt = nowIso;
          payment.annulledReason = reason;
          payment.annulledBy = auth.user!.id;

          let restoredTreatment: any = null;
          if (payment.treatmentId) {
            const treat = (data.treatments || []).find((t: any) => t.id === payment.treatmentId);
            if (treat) {
              treat.paidAmount = Math.max(0, Number(treat.paidAmount || 0) - Number(payment.amount || 0));
              treat.balanceDue = Math.max(0, Number(treat.totalAmount || 0) - treat.paidAmount);
              treat.updatedAt = nowIso;
              restoredTreatment = treat;
            }
          }

          let counterMovement: any = null;
          const openRegister = (data.cashRegisters || []).find(
            (cr: any) => cr.organizationId === orgId && cr.branchId === payment.branchId && cr.status === 'ABIERTA'
          );
          if (openRegister) {
            const origMovement = payment.cashMovementId
              ? (data.cashMovements || []).find((m: any) => m.id === payment.cashMovementId)
              : null;
            let paymentDateAsuncion = '';
            try {
              paymentDateAsuncion = new Date(payment.createdAt).toLocaleDateString('en-CA', {
                timeZone: 'America/Asuncion',
              });
            } catch {
              paymentDateAsuncion = '';
            }
            const belongsToOpenRegister = origMovement
              ? origMovement.cashRegisterId === openRegister.id
              : paymentDateAsuncion === getTodayAsuncionISO();

            if (belongsToOpenRegister) {
              counterMovement = {
                id: crypto.randomUUID(),
                cashRegisterId: openRegister.id,
                movementType: 'EGRESO',
                amount: Number(payment.amount),
                paymentMethod: payment.paymentMethod,
                concept: `[ANULACIÓN] Recibo ${payment.receiptNumber}: ${reason}`,
                referenceNumber: `ANUL-${payment.receiptNumber}`,
                performedBy: auth.user!.id,
                historicalPerformedByName: getUserDisplayName(auth.user!),
                createdAt: nowIso,
              };
              data.cashMovements.unshift(counterMovement);
            }
          }

          reverseCommissionsForAnnulledPayment(data, paymentId, reason, auth.user!.id);
          const updatedCommissions = (data.generatedCommissions || []).filter(
            (c: any) => c.paymentId === paymentId
          );

          data.auditLogs.unshift({
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: payment.branchId,
            userId: auth.user!.id,
            action: 'ANNUL_PAYMENT',
            entity: 'PAYMENT',
            entityId: payment.id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Financial Engine',
            oldValues: {
              status: previousStatus,
              amount: payment.amount,
              receiptNumber: payment.receiptNumber,
            },
            newValues: {
              status: 'ANULADO',
              reason,
              treatmentBalanceRestored: restoredTreatment?.balanceDue ?? null,
            },
            description: `Anulación de Recibo ${payment.receiptNumber} por ₲ ${Number(payment.amount || 0).toLocaleString('es-PY')}. Motivo: "${reason}"`,
            createdAt: nowIso,
          });

          const newAuditLogs = data.auditLogs.slice(0, data.auditLogs.length - auditCountBefore);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              payments: [payment],
              ...(restoredTreatment ? { treatments: [restoredTreatment] } : {}),
              ...(counterMovement ? { cashMovements: [counterMovement] } : {}),
              ...(updatedCommissions.length > 0 ? { generatedCommissions: updatedCommissions } : {}),
              ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
            },
          });

          return res.json({
            payment,
            restoredTreatment,
            counterMovement,
            reversedCommissions: updatedCommissions,
            auditLogs: newAuditLogs,
            stateVersion,
          });
        } catch (err) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // 4. CAJA DIARIA: APERTURA, MOVIMIENTOS Y CIERRE ATÓMICOS
  // =========================================================================

  router.post('/cash-registers/open', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'cash', 'POST /api/cash-registers/open')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canOpenClose =
        actorHasDynamicPermission(auth.actor, 'cash.open_close', roles) ||
        actorHasDynamicPermission(auth.actor, 'cash.manage_own_branch', roles);

      if (!canOpenClose) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para abrir turnos de caja.',
        });
      }

      const branchId = String(req.body?.branchId || '').trim();
      const openingAmount = Number(req.body?.openingAmount ?? 0);
      const observations = String(req.body?.observations || 'Apertura de turno.').trim();

      if (!branchId) {
        return res.status(400).json({ error: 'Debe seleccionar una sucursal.' });
      }
      if (!Number.isFinite(openingAmount) || !Number.isInteger(openingAmount) || openingAmount < 0) {
        return res.status(400).json({ error: 'El fondo inicial de caja en Guaraníes (PYG) debe ser un número entero mayor o igual a ₲ 0.' });
      }

      const preBranch = (initialData.branches || []).find((b: any) => b.id === branchId);
      if (!preBranch) {
        return res.status(404).json({ error: 'Sucursal no encontrada.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preBranch.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preBranch.organizationId !== orgId) {
        return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa.' });
      }
      if (!canActorAccessBranch(auth.actor, branchId, ['cash.open_close'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para abrir caja en esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        if (!Array.isArray(data.cashRegisters)) data.cashRegisters = [];
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const existingOpen = data.cashRegisters.find(
          (cr: any) => cr.branchId === branchId && cr.status === 'ABIERTA'
        );
        if (existingOpen) {
          return res.status(409).json({
            error: 'Ya existe una caja abierta en esta sucursal. Debe cerrar la caja activa antes de abrir un nuevo turno.',
            code: 'CONFLICT_OPEN_CASH_REGISTER',
          });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, ['cashRegisters', 'auditLogs']);
        try {
          const nowIso = new Date().toISOString();
          const newRegister = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId,
            openedBy: auth.user!.id,
            historicalOpenedByName: getUserDisplayName(auth.user!),
            closedBy: null,
            openingAmount,
            closingAmountExpected: null,
            closingAmountReal: null,
            differenceAmount: null,
            status: 'ABIERTA',
            openedAt: nowIso,
            closedAt: null,
            observations,
          };

          data.cashRegisters.unshift(newRegister);

          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId,
            userId: auth.user!.id,
            action: 'OPEN_CASH_REGISTER',
            entity: 'CASH_REGISTER',
            entityId: newRegister.id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Cash Engine',
            oldValues: null,
            newValues: { openingAmount },
            description: `Apertura de caja en ${preBranch.name} con fondo de ₲ ${openingAmount.toLocaleString('es-PY')} por ${getUserDisplayName(auth.user!)}`,
            createdAt: nowIso,
          };
          data.auditLogs.unshift(auditLog);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              cashRegisters: [newRegister],
              auditLogs: [auditLog],
            },
          });

          return res.status(201).json({
            cashRegister: newRegister,
            auditLogs: [auditLog],
            stateVersion,
          });
        } catch (err: any) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          if (err?.code === '23505') {
            return res.status(409).json({
              error: 'Ya existe una caja abierta en esta sucursal.',
              code: 'CONFLICT_OPEN_CASH_REGISTER',
            });
          }
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/cash-registers/:id/movements', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'cash', 'POST /api/cash-registers/:id/movements')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canMove =
        actorHasDynamicPermission(auth.actor, 'cash.movement', roles) ||
        actorHasDynamicPermission(auth.actor, 'cash.open_close', roles) ||
        actorHasDynamicPermission(auth.actor, 'cash.manage_own_branch', roles);

      if (!canMove) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para registrar movimientos de caja.',
        });
      }

      const cashRegisterId = String(req.params.id || '').trim();
      const movementType = String(req.body?.movementType || '').trim().toUpperCase();
      const amount = Number(req.body?.amount);
      const paymentMethod = String(req.body?.paymentMethod || '').trim();
      const concept = String(req.body?.concept || '').trim();
      const referenceNumber = req.body?.referenceNumber ? String(req.body.referenceNumber).trim() : null;
      const requestedReceipt = req.body?.receiptNumber ? String(req.body.receiptNumber).trim() : '';
      const patientId = req.body?.patientId ? String(req.body.patientId).trim() : '';
      const treatmentId = req.body?.treatmentId ? String(req.body.treatmentId).trim() : '';
      const appointmentId = req.body?.appointmentId ? String(req.body.appointmentId).trim() : '';

      if (!['INGRESO', 'EGRESO', 'AJUSTE'].includes(movementType)) {
        return res.status(400).json({ error: 'Tipo de movimiento inválido (use INGRESO, EGRESO o AJUSTE).' });
      }
      if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ error: 'El monto del movimiento en Guaraníes (PYG) debe ser un número entero mayor a ₲ 0.' });
      }
      if (!paymentMethod || !concept) {
        return res.status(400).json({ error: 'Medio de pago y concepto son obligatorios.' });
      }

      const preReg = (initialData.cashRegisters || []).find((cr: any) => cr.id === cashRegisterId);
      if (!preReg) {
        return res.status(404).json({ error: 'La caja especificada no existe.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preReg.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preReg.organizationId !== orgId) {
        return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa.' });
      }
      if (!canActorAccessBranch(auth.actor, preReg.branchId, ['cash.movement', 'cash.open_close'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para operar la caja de esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        ensurePayrollIntegrity(data);
        if (!Array.isArray(data.cashMovements)) data.cashMovements = [];
        if (!Array.isArray(data.payments)) data.payments = [];
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const register = (data.cashRegisters || []).find(
          (cr: any) => cr.id === cashRegisterId && cr.organizationId === orgId
        );
        if (!register) {
          return res.status(404).json({ error: 'La caja especificada no existe.' });
        }
        if (register.status !== 'ABIERTA') {
          return res.status(409).json({
            error: 'La caja se encuentra cerrada. Debe abrir un nuevo turno antes de asentar movimientos.',
            code: 'CONFLICT_CASH_REGISTER_CLOSED',
          });
        }

        if (patientId) {
          const pat = (data.patients || []).find((p: any) => p.id === patientId);
          if (!pat) return res.status(404).json({ error: 'Paciente vinculado no encontrado.' });
          if (pat.organizationId !== orgId) {
            return res.status(403).json({ error: '403 Prohibido: Paciente pertenece a otra organización.' });
          }
        }

        const linkedTreatment = treatmentId
          ? (data.treatments || []).find((t: any) => t.id === treatmentId && t.organizationId === orgId)
          : null;
        const explicitPatientId = patientId || linkedTreatment?.patientId || '';
        const shouldEmitPayment = Boolean(explicitPatientId && movementType === 'INGRESO');
        const resolvedReceipt = shouldEmitPayment
          ? requestedReceipt || getNextReceiptNumberForOrg(data, orgId)
          : '';

        if (resolvedReceipt) {
          const dupReceipt = data.payments.some(
            (p: any) =>
              p.organizationId === orgId &&
              p.status !== 'ANULADO' &&
              String(p.receiptNumber || '').trim() === resolvedReceipt
          );
          if (dupReceipt) {
            return res.status(409).json({
              error: `El número de recibo ${resolvedReceipt} ya fue emitido.`,
              code: 'CONFLICT_DUPLICATE_RECEIPT',
            });
          }
        }

        const rollbackSnap = captureCollectionsSnapshot(data, [
          'cashMovements',
          'payments',
          'generatedCommissions',
          'auditLogs',
        ]);

        try {
          const nowIso = new Date().toISOString();
          const auditCountBefore = data.auditLogs.length;

          const movementId = crypto.randomUUID();
          const newMovement = {
            id: movementId,
            cashRegisterId,
            movementType,
            amount,
            paymentMethod,
            concept,
            referenceNumber,
            performedBy: auth.user!.id,
            historicalPerformedByName: getUserDisplayName(auth.user!),
            createdAt: nowIso,
          };
          data.cashMovements.unshift(newMovement);

          let createdPayment: any = null;
          let generatedCommissions: any[] = [];
          if (shouldEmitPayment && explicitPatientId) {
            const patientIdResolved = explicitPatientId;
            if (patientIdResolved) {
              const payId = crypto.randomUUID();
              createdPayment = {
                id: payId,
                organizationId: orgId,
                branchId: register.branchId,
                patientId: patientIdResolved,
                treatmentId: treatmentId || null,
                appointmentId: appointmentId || null,
                cashMovementId: movementId,
                receiptNumber: resolvedReceipt || getNextReceiptNumberForOrg(data, orgId),
                invoiceNumber: getNextInvoiceNumberForOrg(data, orgId),
                amount,
                paymentMethod,
                status: 'COMPLETADO',
                notes: concept,
                receivedBy: auth.user!.id,
                historicalReceivedByName: getUserDisplayName(auth.user!),
                createdAt: nowIso,
              };
              data.payments.unshift(createdPayment);

              if (movementType === 'INGRESO') {
                const treat = treatmentId ? (data.treatments || []).find((t: any) => t.id === treatmentId) : null;
                const linkedQuote = treat?.quoteId
                  ? (data.quotes || []).find((q: any) => q.id === treat.quoteId)
                  : null;
                generatedCommissions = evaluateCommissionsForEvent(data, {
                  eventType: 'PAYMENT_COLLECTED',
                  organizationId: orgId,
                  branchId: register.branchId,
                  patientId: patientIdResolved,
                  quoteId: treat?.quoteId || null,
                  treatmentId: treatmentId || null,
                  paymentId: payId,
                  odontologistUserId: linkedQuote?.odontologistId || null,
                  amount,
                  actorUserId: auth.user!.id,
                });
              }
            }
          }

          data.auditLogs.unshift({
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: register.branchId,
            userId: auth.user!.id,
            action: 'CASH_MOVEMENT',
            entity: 'CASH_MOVEMENT',
            entityId: movementId,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Cash Engine',
            oldValues: null,
            newValues: { movementType, amount, paymentMethod, concept },
            description: `Movimiento de caja (${movementType}): ${concept} - ₲ ${amount.toLocaleString('es-PY')} (${paymentMethod})`,
            createdAt: nowIso,
          });

          const newAuditLogs = data.auditLogs.slice(0, data.auditLogs.length - auditCountBefore);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              cashMovements: [newMovement],
              ...(createdPayment ? { payments: [createdPayment] } : {}),
              ...(generatedCommissions.length > 0 ? { generatedCommissions } : {}),
              ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
            },
          });

          return res.status(201).json({
            cashMovement: newMovement,
            payment: createdPayment,
            generatedCommissions,
            auditLogs: newAuditLogs,
            stateVersion,
          });
        } catch (err: any) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          if (err?.code === '23505') {
            return res.status(409).json({
              error: 'Conflicto por recibo duplicado en base de datos.',
              code: 'CONFLICT_DUPLICATE_RECEIPT',
            });
          }
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/cash-registers/:id/close', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'cash', 'POST /api/cash-registers/:id/close')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canOpenClose =
        actorHasDynamicPermission(auth.actor, 'cash.open_close', roles) ||
        actorHasDynamicPermission(auth.actor, 'cash.manage_own_branch', roles);

      if (!canOpenClose) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para cerrar turnos de caja.',
        });
      }

      const cashRegisterId = String(req.params.id || '').trim();
      const closingAmountReal = Number(req.body?.closingAmountReal);
      const observations = req.body?.observations ? String(req.body.observations).trim() : '';

      if (!Number.isFinite(closingAmountReal) || !Number.isInteger(closingAmountReal) || closingAmountReal < 0) {
        return res.status(400).json({ error: 'El monto físico contado en Guaraníes (PYG) debe ser un número entero mayor o igual a ₲ 0.' });
      }

      const preReg = (initialData.cashRegisters || []).find((cr: any) => cr.id === cashRegisterId);
      if (!preReg) {
        return res.status(404).json({ error: 'Caja no encontrada.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preReg.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preReg.organizationId !== orgId) {
        return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa.' });
      }
      if (!canActorAccessBranch(auth.actor, preReg.branchId, ['cash.open_close'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para cerrar la caja de esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const register = (data.cashRegisters || []).find(
          (cr: any) => cr.id === cashRegisterId && cr.organizationId === orgId
        );
        if (!register) {
          return res.status(404).json({ error: 'Caja no encontrada.' });
        }
        if (register.status === 'CERRADA') {
          return res.status(409).json({
            error: 'Esta caja ya ha sido cerrada.',
            code: 'CONFLICT_CASH_REGISTER_ALREADY_CLOSED',
          });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, ['cashRegisters', 'auditLogs']);
        try {
          const movements = (data.cashMovements || []).filter((m: any) => m.cashRegisterId === cashRegisterId);
          const cashIngresos = movements
            .filter((m: any) => m.movementType === 'INGRESO' && m.paymentMethod === 'EFECTIVO')
            .reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0);
          const cashEgresos = movements
            .filter((m: any) => m.movementType === 'EGRESO' && m.paymentMethod === 'EFECTIVO')
            .reduce((sum: number, m: any) => sum + Number(m.amount || 0), 0);

          const expectedCash = Number(register.openingAmount || 0) + cashIngresos - cashEgresos;
          const difference = closingAmountReal - expectedCash;
          const nowIso = new Date().toISOString();

          register.status = 'CERRADA';
          register.closedBy = auth.user!.id;
          register.historicalClosedByName = getUserDisplayName(auth.user!);
          register.closedAt = nowIso;
          register.closingAmountExpected = expectedCash;
          register.closingAmountReal = closingAmountReal;
          register.differenceAmount = difference;
          if (observations) {
            register.observations = (register.observations ? `${register.observations} | ` : '') + observations;
          }

          const branch = (data.branches || []).find((b: any) => b.id === register.branchId);
          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: register.branchId,
            userId: auth.user!.id,
            action: 'CLOSE_CASH_REGISTER',
            entity: 'CASH_REGISTER',
            entityId: register.id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Cash Engine',
            oldValues: { status: 'ABIERTA', openingAmount: register.openingAmount },
            newValues: {
              expectedCash,
              closingAmountReal,
              difference,
            },
            description: `Cierre de caja en ${branch?.name || register.branchId}. Esperado: ₲ ${expectedCash.toLocaleString('es-PY')} | Real: ₲ ${closingAmountReal.toLocaleString('es-PY')} (Diferencia: ₲ ${difference.toLocaleString('es-PY')})`,
            createdAt: nowIso,
          };
          data.auditLogs.unshift(auditLog);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              cashRegisters: [register],
              auditLogs: [auditLog],
            },
          });

          return res.json({
            cashRegister: register,
            auditLogs: [auditLog],
            stateVersion,
          });
        } catch (err) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // 5. PRESUPUESTOS: APROBACIÓN / RECHAZO TRANSACCIONAL (GENERA TRATAMIENTO + SEGURO)
  // =========================================================================

  router.post('/quotes/:id/approve', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'quotes', 'POST /api/quotes/:id/approve')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canApprove =
        actorHasDynamicPermission(auth.actor, 'quotes.approve', roles) ||
        actorHasDynamicPermission(auth.actor, 'quotes.manage', roles);

      if (!canApprove) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para aprobar presupuestos.',
        });
      }

      const quoteId = String(req.params.id || '').trim();
      const autoCreateTreatment = req.body?.autoCreateTreatment !== false;
      const preQuote = (initialData.quotes || []).find((q: any) => q.id === quoteId);
      if (!preQuote) {
        return res.status(404).json({ error: 'El presupuesto especificado no existe.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preQuote.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preQuote.organizationId !== orgId) {
        return res.status(403).json({
          error: '403 Prohibido: Violación de aislamiento multiempresa en presupuesto.',
        });
      }
      if (!canActorAccessBranch(auth.actor, preQuote.branchId, ['quotes.approve', 'quotes.manage'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para aprobar presupuestos en esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        if (!Array.isArray(data.treatments)) data.treatments = [];
        if (!Array.isArray(data.insuranceClaims)) data.insuranceClaims = [];
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const quote = (data.quotes || []).find((q: any) => q.id === quoteId && q.organizationId === orgId);
        if (!quote) {
          return res.status(404).json({ error: 'El presupuesto especificado no existe.' });
        }
        if (quote.status === 'APROBADO' || quote.status === 'RECHAZADO') {
          return res.status(409).json({
            error: `Este presupuesto ya se encuentra en estado ${quote.status}.`,
            code: 'CONFLICT_QUOTE_ALREADY_FINALIZED',
          });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, [
          'quotes',
          'treatments',
          'insuranceClaims',
          'auditLogs',
        ]);

        try {
          const nowIso = new Date().toISOString();
          const oldStatus = quote.status;
          quote.status = 'APROBADO';
          quote.updatedAt = nowIso;

          let createdTreatment: any = null;
          let createdClaim: any = null;

          if (autoCreateTreatment) {
            const existingTreatment = data.treatments.find((t: any) => t.quoteId === quoteId);
            if (existingTreatment) {
              createdTreatment = existingTreatment;
            } else {
              const items = (data.quoteItems || []).filter((it: any) => it.quoteId === quoteId);
              const toothNumbers = items
                .map((it: any) => it.toothNumber)
                .filter((tn: any) => tn !== null && tn !== undefined);

              const patient = (data.patients || []).find((p: any) => p.id === quote.patientId);
              // Respetar estrictamente el plan congelado en el presupuesto (null = Particular; undefined = compatibilidad legado)
              const resolvedPlanId =
                quote.planId !== undefined
                  ? quote.planId || null
                  : patient?.modality === 'PLAN_SEGURO'
                    ? patient?.insurancePlanId || null
                    : null;
              const plan = resolvedPlanId
                ? (data.insurancePlans || []).find((p: any) => p.id === resolvedPlanId)
                : null;

              const modality: 'PARTICULAR' | 'PLAN_SEGURO' = resolvedPlanId ? 'PLAN_SEGURO' : 'PARTICULAR';
              const planId = resolvedPlanId;
              const planName = quote.planName || plan?.name || null;
              const totalAmt = Number(quote.finalAmount ?? quote.totalAmount ?? 0);
              const itemsOrigSum = items.reduce(
                (sum: number, it: any) =>
                  sum + Number(it.originalListPrice ?? it.unitPrice ?? 0) * Math.max(1, Number(it.quantity || 1)),
                0
              );
              const origListPrice = Math.max(itemsOrigSum, Number(quote.totalAmount ?? totalAmt));

              const treatmentId = crypto.randomUUID();
              const docId =
                quote.odontologistId ||
                (data.users || []).find((u: any) => u.organizationId === orgId && u.roleId === 'ODONTOLOGO')?.id ||
                null;
              const docObj = docId ? (data.users || []).find((u: any) => u.id === docId) : null;

              createdTreatment = {
                id: treatmentId,
                organizationId: orgId,
                branchId: quote.branchId,
                patientId: quote.patientId,
                quoteId: quote.id,
                serviceId: items[0]?.serviceId || null,
                appliedModality: modality,
                appliedPlanId: planId,
                appliedPlanName: planName,
                originalListPrice: origListPrice,
                finalAppliedPrice: totalAmt,
                title: `Plan Presupuesto ${quote.quoteNumber} (${items[0]?.description || 'Odontología Integral'})`,
                totalAmount: totalAmt,
                paidAmount: 0,
                balanceDue: totalAmt,
                status: 'EN_PROGRESO',
                startDate: getTodayAsuncionISO(),
                completedDate: null,
                toothNumbers,
                odontologistId: docId,
                historicalDoctorName: docObj ? getUserDisplayName(docObj) : undefined,
                notes: `Generado automáticamente por aprobación del presupuesto ${quote.quoteNumber}`,
                createdAt: nowIso,
                updatedAt: nowIso,
              };
              data.treatments.unshift(createdTreatment);

              if (modality === 'PLAN_SEGURO' && planId) {
                const covered = Math.max(0, origListPrice - totalAmt);
                const claimCode = plan?.code ? String(plan.code).replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() : 'SEG';
                const seq = (data.insuranceClaims.length + 1).toString().padStart(4, '0');
                createdClaim = {
                  id: crypto.randomUUID(),
                  organizationId: orgId,
                  branchId: quote.branchId,
                  planId,
                  claimNumber: `LIQ-${claimCode}-2026-${seq}`,
                  patientId: quote.patientId,
                  treatmentId,
                  serviceId: items[0]?.serviceId || null,
                  patientMemberNumber: patient?.insuranceMemberNumber || null,
                  serviceName: createdTreatment.title,
                  toothNumber: toothNumbers[0] || null,
                  originalListPrice: origListPrice,
                  copayAmount: totalAmt,
                  coveredAmount: covered > 0 ? covered : origListPrice,
                  status: 'PENDIENTE_ENVIO',
                  submissionDate: null,
                  settledDate: null,
                  settlementReference: null,
                  notes: `Generado automáticamente por aprobación del presupuesto ${quote.quoteNumber}`,
                  createdAt: nowIso,
                  updatedAt: nowIso,
                };
                data.insuranceClaims.unshift(createdClaim);
              }
            }
          }

          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: quote.branchId,
            userId: auth.user!.id,
            action: 'STATUS_CHANGE',
            entity: 'QUOTE',
            entityId: quote.id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Quotes Engine',
            oldValues: { status: oldStatus },
            newValues: { status: 'APROBADO', generatedTreatmentId: createdTreatment?.id || null },
            description: `Presupuesto ${quote.quoteNumber} aprobado por ${getUserDisplayName(auth.user!)}`,
            createdAt: nowIso,
          };
          data.auditLogs.unshift(auditLog);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              quotes: [quote],
              ...(createdTreatment ? { treatments: [createdTreatment] } : {}),
              ...(createdClaim ? { insuranceClaims: [createdClaim] } : {}),
              auditLogs: [auditLog],
            },
          });

          return res.json({
            quote,
            treatment: createdTreatment,
            insuranceClaim: createdClaim,
            auditLogs: [auditLog],
            stateVersion,
          });
        } catch (err) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/quotes/:id/reject', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'quotes', 'POST /api/quotes/:id/reject')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canReject =
        actorHasDynamicPermission(auth.actor, 'quotes.approve', roles) ||
        actorHasDynamicPermission(auth.actor, 'quotes.manage', roles);

      if (!canReject) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para rechazar presupuestos.',
        });
      }

      const quoteId = String(req.params.id || '').trim();
      const reason = req.body?.reason ? String(req.body.reason).trim() : '';
      const preQuote = (initialData.quotes || []).find((q: any) => q.id === quoteId);
      if (!preQuote) {
        return res.status(404).json({ error: 'El presupuesto especificado no existe.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preQuote.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preQuote.organizationId !== orgId) {
        return res.status(403).json({
          error: '403 Prohibido: Violación de aislamiento multiempresa en presupuesto.',
        });
      }
      if (!canActorAccessBranch(auth.actor, preQuote.branchId, ['quotes.approve', 'quotes.manage'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para rechazar presupuestos en esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const quote = (data.quotes || []).find((q: any) => q.id === quoteId && q.organizationId === orgId);
        if (!quote) {
          return res.status(404).json({ error: 'El presupuesto especificado no existe.' });
        }
        if (quote.status === 'APROBADO' || quote.status === 'RECHAZADO') {
          return res.status(409).json({
            error: `Este presupuesto ya se encuentra en estado ${quote.status}.`,
            code: 'CONFLICT_QUOTE_ALREADY_FINALIZED',
          });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, ['quotes', 'auditLogs']);
        try {
          const nowIso = new Date().toISOString();
          const oldStatus = quote.status;
          quote.status = 'RECHAZADO';
          if (reason) {
            quote.notes = quote.notes ? `${quote.notes} | Rechazo: ${reason}` : `Rechazo: ${reason}`;
          }
          quote.updatedAt = nowIso;

          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: quote.branchId,
            userId: auth.user!.id,
            action: 'STATUS_CHANGE',
            entity: 'QUOTE',
            entityId: quote.id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Quotes Engine',
            oldValues: { status: oldStatus },
            newValues: { status: 'RECHAZADO', reason: reason || null },
            description: `Presupuesto ${quote.quoteNumber} rechazado${reason ? `: ${reason}` : ''}`,
            createdAt: nowIso,
          };
          data.auditLogs.unshift(auditLog);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              quotes: [quote],
              auditLogs: [auditLog],
            },
          });

          return res.json({
            quote,
            auditLogs: [auditLog],
            stateVersion,
          });
        } catch (err) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // 6. TRANSICIÓN TRANSACCIONAL DE TRATAMIENTOS (Y COMISIONES POR FINALIZACIÓN)
  // =========================================================================

  router.patch('/treatments/:id/status', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'treatments', 'PATCH /api/treatments/:id/status')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canManageTreatment =
        actorHasDynamicPermission(auth.actor, 'treatments.manage', roles) ||
        actorHasDynamicPermission(auth.actor, 'clinical.manage', roles) ||
        actorHasDynamicPermission(auth.actor, 'odontogram.manage', roles) ||
        actorHasDynamicPermission(auth.actor, 'quotes.approve', roles);

      if (!canManageTreatment) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para actualizar el estado de tratamientos.',
        });
      }

      const treatmentId = String(req.params.id || '').trim();
      const nextStatus = String(req.body?.status || '').trim().toUpperCase();
      const completedDate = req.body?.completedDate ? String(req.body.completedDate).trim() : '';

      if (!['PLANIFICADO', 'EN_PROGRESO', 'COMPLETADO', 'SUSPENDIDO'].includes(nextStatus)) {
        return res.status(400).json({ error: 'Estado de tratamiento inválido.' });
      }

      const preTreat = (initialData.treatments || []).find((t: any) => t.id === treatmentId);
      if (!preTreat) {
        return res.status(404).json({ error: 'El tratamiento especificado no existe.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preTreat.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preTreat.organizationId !== orgId) {
        return res.status(403).json({
          error: '403 Prohibido: Violación de aislamiento multiempresa en tratamiento.',
        });
      }
      if (!canActorAccessBranch(auth.actor, preTreat.branchId, ['treatments.manage', 'clinical.manage'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee acceso para operar tratamientos en esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        ensurePayrollIntegrity(data);
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const treat = (data.treatments || []).find((t: any) => t.id === treatmentId && t.organizationId === orgId);
        if (!treat) {
          return res.status(404).json({ error: 'El tratamiento especificado no existe.' });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, [
          'treatments',
          'generatedCommissions',
          'auditLogs',
        ]);

        try {
          const nowIso = new Date().toISOString();
          const auditCountBefore = data.auditLogs.length;
          const oldStatus = treat.status;

          treat.status = nextStatus;
          if (nextStatus === 'COMPLETADO') {
            treat.completedDate = completedDate || getTodayAsuncionISO();
          }
          treat.updatedAt = nowIso;

          data.auditLogs.unshift({
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: treat.branchId,
            userId: auth.user!.id,
            action: 'STATUS_CHANGE',
            entity: 'TREATMENT',
            entityId: treatmentId,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Treatments Engine',
            oldValues: { status: oldStatus },
            newValues: { status: nextStatus, completedDate: treat.completedDate || null },
            description: `Actualización de estado de tratamiento "${treat.title}" a "${nextStatus}"`,
            createdAt: nowIso,
          });

          let generatedCommissions: any[] = [];
          if (nextStatus === 'COMPLETADO') {
            const linkedQuote = treat.quoteId ? (data.quotes || []).find((q: any) => q.id === treat.quoteId) : null;
            generatedCommissions = evaluateCommissionsForEvent(data, {
              eventType: 'TREATMENT_COMPLETED',
              organizationId: orgId,
              branchId: treat.branchId,
              patientId: treat.patientId,
              quoteId: treat.quoteId || null,
              treatmentId: treat.id,
              odontologistUserId: linkedQuote?.odontologistId || treat.odontologistId || auth.user!.id,
              amount: Number(treat.totalAmount || 0),
              eventDate: treat.completedDate || getTodayAsuncionISO(),
              actorUserId: auth.user!.id,
            });
          }

          const newAuditLogs = data.auditLogs.slice(0, data.auditLogs.length - auditCountBefore);
          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              treatments: [treat],
              ...(generatedCommissions.length > 0 ? { generatedCommissions } : {}),
              ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
            },
          });

          return res.json({
            treatment: treat,
            generatedCommissions,
            auditLogs: newAuditLogs,
            stateVersion,
          });
        } catch (err) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // 7. TRANSICIÓN DE ESTADO DE CITAS EN AGENDA
  // =========================================================================

  router.patch('/appointments/:id/status', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'agenda', 'PATCH /api/appointments/:id/status')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const canManageAppt =
        actorHasDynamicPermission(auth.actor, 'appointments.manage', roles) ||
        actorHasDynamicPermission(auth.actor, 'appointments.manage_own_branch', roles) ||
        actorHasDynamicPermission(auth.actor, 'appointments.checkin', roles) ||
        actorHasDynamicPermission(auth.actor, 'clinical.manage', roles);

      if (!canManageAppt) {
        return res.status(403).json({
          error: '403 Prohibido: No posee permisos para cambiar el estado de citas clínicas.',
        });
      }

      const appointmentId = String(req.params.id || '').trim();
      const nextStatus = String(req.body?.status || '').trim().toUpperCase();
      const cancellationReason = req.body?.cancellationReason ? String(req.body.cancellationReason).trim() : '';

      const validStatuses = [
        'PENDIENTE',
        'CONFIRMADA',
        'EN_SALA',
        'EN_ATENCION',
        'FINALIZADA',
        'CANCELADA',
        'NO_ASISTIO',
      ];
      if (!validStatuses.includes(nextStatus)) {
        return res.status(400).json({ error: 'Estado de turno inválido.' });
      }
      if (nextStatus === 'CANCELADA' && cancellationReason.length < 3) {
        return res.status(400).json({
          error: 'Debe indicar un motivo válido para cancelar la cita (mínimo 3 caracteres).',
        });
      }

      const preAppt = (initialData.appointments || []).find((a: any) => a.id === appointmentId);
      if (!preAppt) {
        return res.status(404).json({ error: 'La cita especificada no existe.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preAppt.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preAppt.organizationId !== orgId) {
        return res.status(403).json({
          error: '403 Prohibido: Violación de aislamiento multiempresa en cita.',
        });
      }
      if (!canActorAccessBranch(auth.actor, preAppt.branchId, ['appointments.manage'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee permisos para operar turnos de esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const appt = (data.appointments || []).find((a: any) => a.id === appointmentId && a.organizationId === orgId);
        if (!appt) {
          return res.status(404).json({ error: 'La cita especificada no existe.' });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, ['appointments', 'auditLogs']);
        try {
          const nowIso = new Date().toISOString();
          const oldStatus = appt.status;
          appt.status = nextStatus;
          if (cancellationReason) {
            appt.cancellationReason = cancellationReason;
          }
          appt.updatedAt = nowIso;

          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: appt.branchId,
            userId: auth.user!.id,
            action: 'STATUS_CHANGE',
            entity: 'APPOINTMENT',
            entityId: appt.id,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Appointments Engine',
            oldValues: { status: oldStatus },
            newValues: { status: nextStatus, cancellationReason: cancellationReason || null },
            description: `Cambio de estado de turno a "${nextStatus}"${cancellationReason ? ` (Motivo: ${cancellationReason})` : ''}`,
            createdAt: nowIso,
          };
          data.auditLogs.unshift(auditLog);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              appointments: [appt],
              auditLogs: [auditLog],
            },
          });

          return res.json({
            appointment: appt,
            auditLogs: [auditLog],
            stateVersion,
          });
        } catch (err) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // 8. HISTORIA CLÍNICA AUTORITATIVA (LEY N° 1682/01 Y FIRMA PROFESIONAL)
  // =========================================================================

  router.post('/clinical-records', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado.' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'clinical', 'POST /api/clinical-records')) return;

      const initialData = getServerDbState().data || {};
      const roles = initialData.roles || [];
      const hasClinicalRole = CLINICAL_ACCESS_ROLES.has(auth.actor.role);
      const canWriteClinical =
        hasClinicalRole &&
        (actorHasDynamicPermission(auth.actor, 'clinical.manage', roles) ||
          actorHasDynamicPermission(auth.actor, 'anamnesis.manage', roles));

      if (!canWriteClinical) {
        return res.status(403).json({
          error: '403 Prohibido: Confidencialidad médica (Ley 1682/01). Solo personal clínico autorizado puede registrar evoluciones.',
        });
      }

      const body = req.body || {};
      const branchId = String(body.branchId || '').trim();
      const patientId = String(body.patientId || '').trim();
      const odontologistId = String(body.odontologistId || auth.user.id).trim();
      const diagnosis = String(body.diagnosis || '').trim();
      const treatmentPerformed = String(body.treatmentPerformed || '').trim();

      if (!branchId || !patientId || !odontologistId || !diagnosis || !treatmentPerformed) {
        return res.status(400).json({
          error: 'Sucursal, paciente, odontólogo, diagnóstico y procedimiento realizado son obligatorios.',
        });
      }

      const preBranch = (initialData.branches || []).find((b: any) => b.id === branchId);
      if (!preBranch) {
        return res.status(404).json({ error: 'Sucursal no encontrada.' });
      }

      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? String(preBranch.organizationId || auth.actor.organizationId)
          : auth.actor.organizationId;

      if (auth.actor.role !== 'SUPER_ADMIN' && preBranch.organizationId !== orgId) {
        return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa en sucursal.' });
      }
      if (!canActorAccessBranch(auth.actor, branchId, ['clinical.manage'], roles)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para registrar evoluciones clínicas en esta sucursal.',
        });
      }

      return await withOrgTransactionLock(orgId, async () => {
        const data = getServerDbState().data;
        if (!Array.isArray(data.clinicalRecords)) data.clinicalRecords = [];
        if (!Array.isArray(data.patientBranches)) data.patientBranches = [];
        if (!Array.isArray(data.auditLogs)) data.auditLogs = [];

        const patient = (data.patients || []).find((p: any) => p.id === patientId);
        if (!patient) return res.status(404).json({ error: 'Paciente no encontrado.' });
        if (patient.organizationId !== orgId) {
          return res.status(403).json({ error: '403 Prohibido: Paciente pertenece a otra organización.' });
        }

        const doctor = (data.users || []).find((u: any) => u.id === odontologistId);
        if (!doctor) return res.status(404).json({ error: 'Odontólogo firmante no encontrado.' });
        if (doctor.organizationId !== orgId) {
          return res.status(403).json({ error: '403 Prohibido: Profesional pertenece a otra organización.' });
        }

        const rawRecordDate = body.recordDate ? String(body.recordDate).trim() : '';
        if (rawRecordDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawRecordDate)) {
          return res.status(400).json({ error: 'La fecha de atención clínica debe tener formato válido (AAAA-MM-DD).' });
        }

        const rollbackSnap = captureCollectionsSnapshot(data, [
          'clinicalRecords',
          'appointments',
          'patientBranches',
          'auditLogs',
        ]);

        try {
          const nowIso = new Date().toISOString();
          const todayPy = getTodayAsuncionISO();
          const effectiveRecordDate = rawRecordDate || todayPy;
          const recordCreatedAtIso =
            rawRecordDate && rawRecordDate !== todayPy
              ? new Date(`${rawRecordDate}T16:00:00.000Z`).toISOString()
              : nowIso;
          const recordId = crypto.randomUUID();
          const appointmentId = body.appointmentId ? String(body.appointmentId).trim() : null;
          const newRecord = {
            id: recordId,
            organizationId: orgId,
            branchId,
            patientId,
            odontologistId,
            historicalDoctorName: getUserDisplayName(doctor),
            odontologistLicenseSnapshot: doctor.medicalLicenseNumber || doctor.professionalLicense || null,
            appointmentId,
            reasonForConsultation: String(body.reasonForConsultation || 'Consulta odontológica programada').trim(),
            diagnosis,
            treatmentPerformed,
            prescriptions: String(body.prescriptions || '').trim(),
            recommendations: String(body.recommendations || '').trim(),
            internalNotes: String(body.internalNotes || '').trim(),
            attachments: [],
            createdAt: recordCreatedAtIso,
            updatedAt: nowIso,
          };

          data.clinicalRecords.unshift(newRecord);

          let finalizedAppointment: any = null;
          if (appointmentId && Array.isArray(data.appointments)) {
            const linkedApp = data.appointments.find(
              (a: any) => a.id === appointmentId && a.organizationId === orgId && a.patientId === patientId
            );
            if (linkedApp && linkedApp.status !== 'FINALIZADA' && linkedApp.status !== 'CANCELADA') {
              linkedApp.status = 'FINALIZADA';
              linkedApp.updatedAt = nowIso;
              finalizedAppointment = linkedApp;
            }
          }

          const patientBranch = updatePatientBranchVisitDates(
            data.patientBranches,
            patientId,
            branchId,
            effectiveRecordDate
          );

          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId,
            userId: auth.user!.id,
            action: 'CREATE',
            entity: 'CLINICAL_RECORD',
            entityId: recordId,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend Clinical Engine',
            oldValues: null,
            newValues: { diagnosis, odontologistId, patientId, recordDate: effectiveRecordDate },
            description: `Evolución clínica (${effectiveRecordDate}) firmada por ${formatProfessionalName(doctor, { fallback: getUserDisplayName(doctor) })} para ${patient.firstName} ${patient.lastName}`,
            createdAt: nowIso,
          };
          data.auditLogs.unshift(auditLog);

          const stateVersion = await saveDatabaseStateStrict({
            upserts: {
              clinicalRecords: [newRecord],
              ...(finalizedAppointment ? { appointments: [finalizedAppointment] } : {}),
              patientBranches: [patientBranch],
              auditLogs: [auditLog],
            },
          });

          return res.status(201).json({
            clinicalRecord: newRecord,
            ...(finalizedAppointment ? { appointment: finalizedAppointment } : {}),
            patientBranch,
            auditLogs: [auditLog],
            stateVersion,
          });
        } catch (err) {
          restoreCollectionsSnapshot(data, rollbackSnap);
          throw err;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
