import express from 'express';
import crypto from 'crypto';
import { isSuperAdminRole } from '../../src/security/rbacHierarchy.ts';
import { getTodayAsuncionISO } from '../../src/config/appBrand.ts';
import {
  HistoricalImportEntity,
  normalizePaymentMethod,
  normalizeTreatmentStatus,
  parseFlexibleDateISO,
  parseHistoricalPygAmount,
} from '../../src/utils/historicalCsv.ts';
import {
  actorHasDynamicPermission,
  getServerDbState,
  saveDatabaseStateStrict,
  withOrgTransactionLock,
} from '../stateStore.ts';
import { authenticateServerRequest, denyIfModuleNotAllowed } from '../security.ts';

const MAX_IMPORT_ROWS = 1000;

interface ImportRowOutcome {
  rowNumber: number;
  status: 'VALID' | 'SKIPPED' | 'ERROR';
  summary: string;
  reason?: string;
  amountPyg?: number;
}

function getUserDisplayName(user: any): string {
  if (!user) return 'Usuario';
  const full = `${String(user.firstName || '').trim()} ${String(user.lastName || '').trim()}`.trim();
  return full || String(user.email || 'Usuario');
}

function normalizeDoc(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function parseToothNumbers(raw: unknown): number[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  const parts = s.split(/[\s,;|]+/).filter(Boolean);
  const nums: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (Number.isInteger(n) && n >= 11 && n <= 85 && !nums.includes(n)) {
      nums.push(n);
    }
  }
  return nums;
}

function getNextHistoricalReceiptSeq(existingPayments: any[]): number {
  let maxSeq = 0;
  for (const p of existingPayments) {
    const match = String(p?.receiptNumber || '').match(/HIST-(\d{4})-(\d+)/i);
    if (match && match[2]) {
      const n = parseInt(match[2], 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return maxSeq;
}

export function createHistoricalImportRouter(): express.Router {
  const router = express.Router();

  /**
   * POST /api/historical-import
   * Carga masiva histórica (Pacientes, Tratamientos o Cobros) con modo simulación (dry_run)
   * y guardado definitivo atómico (commit).
   * - Nunca sobrescribe ni altera registros existentes.
   * - Congela el precio histórico del tratamiento en el registro (independiente del catálogo actual).
   * - Los cobros históricos NO alteran la caja abierta de hoy.
   */
  router.post('/historical-import', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({
          error: auth.error || '401 No autorizado: Se requiere sesión autenticada.',
        });
      }

      const body = req.body || {};
      const entityType = String(body.entityType || '').trim() as HistoricalImportEntity;
      const mode = body.mode === 'commit' ? 'commit' : 'dry_run';
      const rows = Array.isArray(body.rows) ? body.rows : null;
      const requestedBranchId = typeof body.branchId === 'string' ? body.branchId.trim() : '';

      if (!['patients', 'treatments', 'payments'].includes(entityType)) {
        return res.status(400).json({
          error: 'Tipo de importación inválido. Use "patients", "treatments" o "payments".',
        });
      }

      const requiredModule: 'patients' | 'treatments' | Array<'cash' | 'treatments'> =
        entityType === 'patients'
          ? 'patients'
          : entityType === 'payments'
            ? ['cash', 'treatments']
            : 'treatments';
      if (denyIfModuleNotAllowed(auth, res, requiredModule, `POST /api/historical-import (${entityType})`)) {
        return;
      }

      const serverDbState = getServerDbState();
      const roles = serverDbState.data?.roles || [];
      const isSuperAdmin = isSuperAdminRole(auth.user.roleId);
      const can = (perm: string) => isSuperAdmin || actorHasDynamicPermission(auth.actor!, perm, roles);

      if (entityType === 'patients' && !can('patients.manage')) {
        return res.status(403).json({
          error: '403 Prohibido: No tiene permiso (patients.manage) para importar pacientes.',
        });
      }
      if (entityType === 'treatments' && !can('treatments.manage')) {
        return res.status(403).json({
          error: '403 Prohibido: No tiene permiso (treatments.manage) para importar tratamientos.',
        });
      }
      if (entityType === 'payments' && !can('cash.manage') && !can('payments.create') && !can('treatments.manage')) {
        return res.status(403).json({
          error: '403 Prohibido: No tiene permisos financieros para importar cobros históricos.',
        });
      }

      if (!rows || rows.length === 0) {
        return res.status(400).json({
          error: 'No se recibieron filas para analizar. Cargue un archivo CSV con al menos un registro.',
        });
      }
      if (rows.length > MAX_IMPORT_ROWS) {
        return res.status(400).json({
          error: `Por seguridad, el máximo permitido por lote es de ${MAX_IMPORT_ROWS} filas (recibidas: ${rows.length}). Divida la planilla en lotes más pequeños.`,
        });
      }

      const orgId = isSuperAdmin
        ? String(body.organizationId || serverDbState.data?.organization?.id || auth.actor.organizationId)
        : auth.actor.organizationId;

      return await withOrgTransactionLock(orgId, async () => {
        const curState = getServerDbState();
        const data = curState.data;
        const orgBranches = (data.branches || []).filter((b: any) => b.organizationId === orgId);
        const allowedBranchIds = auth.actor!.allowedBranchIds || [];

        let targetBranch = requestedBranchId
          ? orgBranches.find((b: any) => b.id === requestedBranchId)
          : orgBranches.find((b: any) => b.status !== 'INACTIVE') || orgBranches[0];

        if (!targetBranch) {
          return res.status(400).json({
            error: 'No se encontró una sucursal válida para asignar los registros importados.',
          });
        }
        if (
          !isSuperAdmin &&
          auth.actor!.role !== 'ADMIN_CLINICA' &&
          allowedBranchIds.length > 0 &&
          !allowedBranchIds.includes(targetBranch.id)
        ) {
          return res.status(403).json({
            error: '403 Prohibido: Solo puede importar registros históricos en sus sucursales asignadas.',
          });
        }

        const nowIso = new Date().toISOString();
        const todayPy = getTodayAsuncionISO();
        const actorDisplayName = getUserDisplayName(auth.user);

        const outcomes: ImportRowOutcome[] = [];
        const newPatients: any[] = [];
        const newPatientBranches: any[] = [];
        const newTreatments: any[] = [];
        const updatedTreatmentsMap = new Map<string, any>();
        const newPayments: any[] = [];

        let validCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let totalAmountPyg = 0;
        let totalPaidPyg = 0;

        const orgPatients = (data.patients || []).filter((p: any) => p.organizationId === orgId);
        const orgServices = (data.services || []).filter((s: any) => s.organizationId === orgId);
        const orgTreatments = (data.treatments || []).filter((t: any) => t.organizationId === orgId);
        const orgPayments = (data.payments || []).filter((p: any) => p.organizationId === orgId);

        const patientByDoc = new Map<string, any>();
        for (const p of orgPatients) {
          const k = normalizeDoc(p.documentNumber);
          if (k) patientByDoc.set(k, p);
        }

        const existingReceiptNumbers = new Set<string>(
          orgPayments.map((p: any) => String(p.receiptNumber || '').trim().toUpperCase()).filter(Boolean)
        );
        let histReceiptSeq = getNextHistoricalReceiptSeq(orgPayments);
        const nextHistReceipt = (year: string) => {
          let candidate = '';
          do {
            histReceiptSeq += 1;
            candidate = `HIST-${year}-${String(histReceiptSeq).padStart(5, '0')}`;
          } while (existingReceiptNumbers.has(candidate.toUpperCase()));
          existingReceiptNumbers.add(candidate.toUpperCase());
          return candidate;
        };

        const defaultDoctor =
          (data.users || []).find(
            (u: any) => u.organizationId === orgId && u.roleId === 'ODONTOLOGO' && u.status === 'ACTIVE'
          ) || auth.user!;

        // ------------------------------------------------------------------
        // 1) IMPORTACIÓN DE PACIENTES HISTÓRICOS
        // ------------------------------------------------------------------
        if (entityType === 'patients') {
          const batchDocsSeen = new Set<string>();

          rows.forEach((rawRow: any, idx: number) => {
            const rowNum = idx + 2; // Fila 1 es cabecera
            const firstName = String(rawRow?.nombres || rawRow?.firstName || '').trim();
            const lastName = String(rawRow?.apellidos || rawRow?.lastName || '').trim();
            const documentNumber = String(rawRow?.documento || rawRow?.ci || rawRow?.documentNumber || '').trim();
            const normDoc = normalizeDoc(documentNumber);

            if (!firstName || !lastName || !normDoc) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `${firstName || '(sin nombre)'} ${lastName || ''}`.trim(),
                reason: 'Faltan campos obligatorios: nombres, apellidos y documento (C.I.).',
              });
              return;
            }

            if (patientByDoc.has(normDoc)) {
              skippedCount += 1;
              const existing = patientByDoc.get(normDoc);
              outcomes.push({
                rowNumber: rowNum,
                status: 'SKIPPED',
                summary: `${firstName} ${lastName} (C.I. ${documentNumber})`,
                reason: `Ya existe en la clínica (${existing.firstName} ${existing.lastName}). No se sobrescribe.`,
              });
              return;
            }

            if (batchDocsSeen.has(normDoc)) {
              skippedCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'SKIPPED',
                summary: `${firstName} ${lastName} (C.I. ${documentNumber})`,
                reason: 'Documento duplicado dentro de la misma planilla (se toma la primera aparición).',
              });
              return;
            }

            const rawBirth = String(rawRow?.fecha_nacimiento || rawRow?.birthDate || '').trim();
            let birthDate: string | null = null;
            if (rawBirth) {
              birthDate = parseFlexibleDateISO(rawBirth);
              if (!birthDate) {
                errorCount += 1;
                outcomes.push({
                  rowNumber: rowNum,
                  status: 'ERROR',
                  summary: `${firstName} ${lastName} (C.I. ${documentNumber})`,
                  reason: `Fecha de nacimiento inválida: "${rawBirth}". Use DD/MM/AAAA o AAAA-MM-DD.`,
                });
                return;
              }
            }

            const rawCreated = String(rawRow?.fecha_alta || rawRow?.createdAt || '').trim();
            let createdDateIso = todayPy;
            if (rawCreated) {
              const parsed = parseFlexibleDateISO(rawCreated);
              if (!parsed) {
                errorCount += 1;
                outcomes.push({
                  rowNumber: rowNum,
                  status: 'ERROR',
                  summary: `${firstName} ${lastName} (C.I. ${documentNumber})`,
                  reason: `Fecha de alta histórica inválida: "${rawCreated}". Use DD/MM/AAAA o AAAA-MM-DD.`,
                });
                return;
              }
              createdDateIso = parsed;
            }

            const phone = String(rawRow?.telefono || rawRow?.phone || '').trim() || 'Sin teléfono';
            const email = String(rawRow?.email || '').trim() || null;
            const city = String(rawRow?.ciudad || rawRow?.city || '').trim() || targetBranch.city || 'Asunción';
            const rawModality = String(rawRow?.modalidad || rawRow?.modality || 'PARTICULAR').trim().toUpperCase();
            const modality = rawModality.includes('SEGURO') || rawModality.includes('PLAN') ? 'PLAN_SEGURO' : 'PARTICULAR';
            const allergies = String(rawRow?.alergias || rawRow?.allergies || '').trim() || 'Ninguna conocida';

            const patientId = crypto.randomUUID();
            const createdAtTimestamp = `${createdDateIso}T16:00:00.000Z`;

            batchDocsSeen.add(normDoc);
            validCount += 1;
            outcomes.push({
              rowNumber: rowNum,
              status: 'VALID',
              summary: `${firstName} ${lastName} (C.I. ${documentNumber}) — Alta ${createdDateIso}`,
            });

            newPatients.push({
              id: patientId,
              organizationId: orgId,
              primaryBranchId: targetBranch.id,
              documentType: 'CI',
              documentNumber,
              firstName,
              lastName,
              birthDate,
              gender: 'NO_ESPECIFICA',
              phone,
              whatsapp: phone,
              email,
              department: targetBranch.department || 'Central',
              city,
              neighborhood: null,
              address: null,
              emergencyContactName: null,
              emergencyContactPhone: null,
              bloodType: null,
              allergies,
              medicalConditions: 'Ninguna',
              medications: 'Ninguna',
              modality,
              insurancePlanId: null,
              insuranceMemberNumber: null,
              assignedAdvisorId: null,
              assignedAt: null,
              assignedByUserId: null,
              createdByUserId: auth.user!.id,
              createdByNameSnapshot: actorDisplayName,
              status: 'ACTIVE',
              createdAt: createdAtTimestamp,
              updatedAt: nowIso,
            });
            newPatientBranches.push({
              patientId,
              branchId: targetBranch.id,
              firstVisitDate: createdDateIso,
              lastVisitDate: createdDateIso,
            });
          });
        }

        // ------------------------------------------------------------------
        // 2) IMPORTACIÓN DE TRATAMIENTOS HISTÓRICOS (PRECIO CONGELADO)
        // ------------------------------------------------------------------
        if (entityType === 'treatments') {
          rows.forEach((rawRow: any, idx: number) => {
            const rowNum = idx + 2;
            const rawDoc = String(rawRow?.documento_paciente || rawRow?.documento || rawRow?.ci || '').trim();
            const normDoc = normalizeDoc(rawDoc);
            const title = String(rawRow?.titulo_tratamiento || rawRow?.titulo || rawRow?.procedimiento || '').trim();
            const rawTotal = rawRow?.monto_total_gs ?? rawRow?.monto_total ?? rawRow?.precio ?? '';
            const rawPaid = rawRow?.monto_pagado_gs ?? rawRow?.monto_pagado ?? '';
            const rawDate = String(rawRow?.fecha_tratamiento || rawRow?.fecha || '').trim();

            if (!normDoc || !title || !rawDate) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `${rawDoc || '(sin C.I.)'} — ${title || '(sin título)'}`,
                reason: 'Faltan campos obligatorios: documento_paciente, titulo_tratamiento y fecha_tratamiento.',
              });
              return;
            }

            const patient = patientByDoc.get(normDoc);
            if (!patient) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `C.I. ${rawDoc} — ${title}`,
                reason: `No existe un paciente con C.I. "${rawDoc}". Importe primero los pacientes.`,
              });
              return;
            }

            const treatDateIso = parseFlexibleDateISO(rawDate);
            if (!treatDateIso) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `${patient.firstName} ${patient.lastName} — ${title}`,
                reason: `Fecha del tratamiento inválida: "${rawDate}". Use DD/MM/AAAA o AAAA-MM-DD.`,
              });
              return;
            }

            const parsedTotal = parseHistoricalPygAmount(rawTotal);
            if (!parsedTotal.ok || parsedTotal.value <= 0) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `${patient.firstName} ${patient.lastName} — ${title}`,
                reason: !parsedTotal.ok
                  ? parsedTotal.error
                  : 'El monto total del tratamiento debe ser mayor a ₲ 0.',
              });
              return;
            }

            let paidAmount = 0;
            if (String(rawPaid).trim() !== '') {
              const parsedPaid = parseHistoricalPygAmount(rawPaid);
              if (!parsedPaid.ok) {
                errorCount += 1;
                outcomes.push({
                  rowNumber: rowNum,
                  status: 'ERROR',
                  summary: `${patient.firstName} ${patient.lastName} — ${title}`,
                  reason: `Monto pagado inválido: ${parsedPaid.error}`,
                });
                return;
              }
              paidAmount = parsedPaid.value;
            }

            if (paidAmount > parsedTotal.value) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `${patient.firstName} ${patient.lastName} — ${title}`,
                reason: `El monto pagado (₲ ${paidAmount.toLocaleString('es-PY')}) supera el monto total (₲ ${parsedTotal.value.toLocaleString('es-PY')}).`,
              });
              return;
            }

            const serviceCode = String(rawRow?.codigo_servicio || '').trim().toUpperCase();
            const matchedService = serviceCode
              ? orgServices.find((s: any) => String(s.code || '').trim().toUpperCase() === serviceCode)
              : null;

            const status = normalizeTreatmentStatus(rawRow?.estado);
            const toothNumbers = parseToothNumbers(rawRow?.piezas_fdi || rawRow?.piezas);
            const notes = String(rawRow?.notas || rawRow?.observaciones || '').trim();
            const balanceDue = Math.max(0, parsedTotal.value - paidAmount);
            const treatmentId = crypto.randomUUID();
            const createdAtIso = `${treatDateIso}T16:00:00.000Z`;

            validCount += 1;
            totalAmountPyg += parsedTotal.value;
            totalPaidPyg += paidAmount;

            outcomes.push({
              rowNumber: rowNum,
              status: 'VALID',
              summary: `${patient.firstName} ${patient.lastName} • ${title} (${treatDateIso})`,
              amountPyg: parsedTotal.value,
              reason:
                paidAmount > 0
                  ? `Total ₲ ${parsedTotal.value.toLocaleString('es-PY')} | Pagado ₲ ${paidAmount.toLocaleString('es-PY')} | Saldo ₲ ${balanceDue.toLocaleString('es-PY')}`
                  : `Total ₲ ${parsedTotal.value.toLocaleString('es-PY')} | Saldo pendiente ₲ ${balanceDue.toLocaleString('es-PY')}`,
            });

            newTreatments.push({
              id: treatmentId,
              organizationId: orgId,
              branchId: targetBranch.id,
              patientId: patient.id,
              quoteId: null,
              serviceId: matchedService?.id || null,
              odontologistId: defaultDoctor.id,
              historicalDoctorName: getUserDisplayName(defaultDoctor),
              title,
              description: notes || `Tratamiento histórico cargado (${treatDateIso})`,
              toothNumbers,
              status,
              startDate: treatDateIso,
              estimatedEndDate: status === 'COMPLETADO' ? treatDateIso : null,
              completedAt: status === 'COMPLETADO' ? createdAtIso : null,
              totalAmount: parsedTotal.value,
              originalListPrice: parsedTotal.value,
              paidAmount,
              balanceDue,
              appliedModality: 'PARTICULAR',
              appliedPlanId: null,
              appliedPlanName: null,
              createdAt: createdAtIso,
              updatedAt: nowIso,
            });

            // Si el tratamiento histórico ya tenía monto pagado, registrar su recibo histórico sin tocar caja de hoy
            if (paidAmount > 0) {
              const year = treatDateIso.slice(0, 4);
              const receiptNumber = nextHistReceipt(year);
              newPayments.push({
                id: crypto.randomUUID(),
                organizationId: orgId,
                branchId: targetBranch.id,
                patientId: patient.id,
                treatmentId,
                appointmentId: null,
                cashMovementId: null,
                receiptNumber,
                invoiceNumber: null,
                amount: paidAmount,
                paymentMethod: 'EFECTIVO',
                status: 'COMPLETADO',
                notes: `Pago histórico (${treatDateIso}) importado junto al tratamiento "${title}"`,
                receivedBy: auth.user!.id,
                historicalReceivedByName: actorDisplayName,
                createdAt: createdAtIso,
              });
            }
          });
        }

        // ------------------------------------------------------------------
        // 3) IMPORTACIÓN DE COBROS HISTÓRICOS (SIN ALTERAR CAJA DE HOY)
        // ------------------------------------------------------------------
        if (entityType === 'payments') {
          // Clones de trabajo para validar saldos acumulados dentro del mismo lote
          const workingTreatments = orgTreatments.map((t: any) => ({ ...t }));

          rows.forEach((rawRow: any, idx: number) => {
            const rowNum = idx + 2;
            const rawDoc = String(rawRow?.documento_paciente || rawRow?.documento || rawRow?.ci || '').trim();
            const normDoc = normalizeDoc(rawDoc);
            const rawAmount = rawRow?.monto_gs ?? rawRow?.monto ?? '';
            const rawDate = String(rawRow?.fecha_cobro || rawRow?.fecha || '').trim();
            const treatTitleHint = String(rawRow?.titulo_tratamiento || rawRow?.tratamiento || '').trim().toLowerCase();
            const rawReceipt = String(rawRow?.nro_recibo || rawRow?.recibo || '').trim();

            if (!normDoc || !rawDate) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `C.I. ${rawDoc || '(vacío)'}`,
                reason: 'Faltan campos obligatorios: documento_paciente y fecha_cobro.',
              });
              return;
            }

            const patient = patientByDoc.get(normDoc);
            if (!patient) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `C.I. ${rawDoc}`,
                reason: `No existe un paciente con C.I. "${rawDoc}".`,
              });
              return;
            }

            const payDateIso = parseFlexibleDateISO(rawDate);
            if (!payDateIso) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `${patient.firstName} ${patient.lastName}`,
                reason: `Fecha de cobro inválida: "${rawDate}". Use DD/MM/AAAA o AAAA-MM-DD.`,
              });
              return;
            }

            const parsedAmt = parseHistoricalPygAmount(rawAmount);
            if (!parsedAmt.ok || parsedAmt.value <= 0) {
              errorCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'ERROR',
                summary: `${patient.firstName} ${patient.lastName} (${payDateIso})`,
                reason: !parsedAmt.ok ? parsedAmt.error : 'El monto cobrado debe ser mayor a ₲ 0.',
              });
              return;
            }

            if (rawReceipt && existingReceiptNumbers.has(rawReceipt.toUpperCase())) {
              skippedCount += 1;
              outcomes.push({
                rowNumber: rowNum,
                status: 'SKIPPED',
                summary: `${patient.firstName} ${patient.lastName} • Recibo ${rawReceipt}`,
                reason: `El recibo "${rawReceipt}" ya existe en el sistema. Se omite para evitar duplicados.`,
              });
              return;
            }

            const patientTreatments = workingTreatments.filter(
              (t: any) => t.patientId === patient.id && t.status !== 'CANCELADO'
            );
            let linkedTreatment: any = null;
            if (treatTitleHint) {
              linkedTreatment =
                patientTreatments.find((t: any) => String(t.title || '').toLowerCase() === treatTitleHint) ||
                patientTreatments.find((t: any) => String(t.title || '').toLowerCase().includes(treatTitleHint));
            } else {
              linkedTreatment = patientTreatments.find((t: any) => Number(t.balanceDue || 0) >= parsedAmt.value) || patientTreatments[0] || null;
            }

            if (linkedTreatment) {
              const currentBalance = Number(linkedTreatment.balanceDue || 0);
              if (currentBalance <= 0) {
                errorCount += 1;
                outcomes.push({
                  rowNumber: rowNum,
                  status: 'ERROR',
                  summary: `${patient.firstName} ${patient.lastName} • ${linkedTreatment.title}`,
                  reason: `El tratamiento "${linkedTreatment.title}" ya está saldado en su totalidad (saldo ₲ 0).`,
                });
                return;
              }
              if (parsedAmt.value > currentBalance) {
                errorCount += 1;
                outcomes.push({
                  rowNumber: rowNum,
                  status: 'ERROR',
                  summary: `${patient.firstName} ${patient.lastName} • ${linkedTreatment.title}`,
                  reason: `El cobro (₲ ${parsedAmt.value.toLocaleString('es-PY')}) excede el saldo pendiente del tratamiento (₲ ${currentBalance.toLocaleString('es-PY')}).`,
                });
                return;
              }
              linkedTreatment.paidAmount = Number(linkedTreatment.paidAmount || 0) + parsedAmt.value;
              linkedTreatment.balanceDue = Math.max(0, Number(linkedTreatment.totalAmount || 0) - linkedTreatment.paidAmount);
              linkedTreatment.updatedAt = nowIso;
              updatedTreatmentsMap.set(linkedTreatment.id, linkedTreatment);
            }

            const finalReceipt = rawReceipt || nextHistReceipt(payDateIso.slice(0, 4));
            if (rawReceipt) {
              existingReceiptNumbers.add(rawReceipt.toUpperCase());
            }

            const paymentMethod = normalizePaymentMethod(rawRow?.metodo_pago || rawRow?.metodo);
            const notes =
              String(rawRow?.notas || rawRow?.concepto || '').trim() ||
              (linkedTreatment
                ? `Cobro histórico (${payDateIso}) — ${linkedTreatment.title}`
                : `Cobro histórico (${payDateIso}) importado desde planilla`);

            validCount += 1;
            totalAmountPyg += parsedAmt.value;
            totalPaidPyg += parsedAmt.value;

            outcomes.push({
              rowNumber: rowNum,
              status: 'VALID',
              summary: `${patient.firstName} ${patient.lastName} • ${finalReceipt} (${payDateIso})`,
              amountPyg: parsedAmt.value,
              reason: linkedTreatment
                ? `Vinculado a "${linkedTreatment.title}" • ${paymentMethod}`
                : `Recibo histórico directo • ${paymentMethod}`,
            });

            newPayments.push({
              id: crypto.randomUUID(),
              organizationId: orgId,
              branchId: linkedTreatment?.branchId || targetBranch.id,
              patientId: patient.id,
              treatmentId: linkedTreatment?.id || null,
              appointmentId: null,
              cashMovementId: null, // Cobros históricos NUNCA alteran la caja abierta de hoy
              receiptNumber: finalReceipt,
              invoiceNumber: null,
              amount: parsedAmt.value,
              paymentMethod,
              status: 'COMPLETADO',
              notes,
              receivedBy: auth.user!.id,
              historicalReceivedByName: actorDisplayName,
              createdAt: `${payDateIso}T16:00:00.000Z`,
            });
          });
        }

        const summaryPayload = {
          mode,
          entityType,
          branchId: targetBranch.id,
          branchName: targetBranch.name,
          totalRows: rows.length,
          validCount,
          skippedCount,
          errorCount,
          totalAmountPyg,
          totalPaidPyg,
          willCreatePatients: newPatients.length,
          willCreateTreatments: newTreatments.length,
          willCreatePayments: newPayments.length,
          outcomes: outcomes.slice(0, 200),
          outcomesTruncated: outcomes.length > 200,
        };

        // En modo simulación (dry_run), NO modificamos nada ni persistimos en la base de datos
        if (mode === 'dry_run') {
          return res.json(summaryPayload);
        }

        if (validCount === 0) {
          return res.status(400).json({
            error: 'No hay filas válidas para importar. Revise los errores o duplicados detectados en la simulación.',
            ...summaryPayload,
          });
        }

        // Respaldo en memoria para revertir si falla la persistencia en PostgreSQL
        const prevPatients = data.patients;
        const prevPatientBranches = data.patientBranches;
        const prevTreatments = data.treatments;
        const prevPayments = data.payments;
        const prevAuditLogs = data.auditLogs;

        try {
          // Aplicar cambios de forma inmutable en el estado del servidor
          if (newPatients.length > 0) {
            data.patients = [...newPatients, ...(data.patients || [])];
          }
          if (newPatientBranches.length > 0) {
            data.patientBranches = [...(data.patientBranches || []), ...newPatientBranches];
          }
          if (newTreatments.length > 0) {
            data.treatments = [...newTreatments, ...(data.treatments || [])];
          }
          if (updatedTreatmentsMap.size > 0) {
            data.treatments = (data.treatments || []).map((t: any) =>
              updatedTreatmentsMap.has(t.id) ? updatedTreatmentsMap.get(t.id) : t
            );
          }
          if (newPayments.length > 0) {
            data.payments = [...newPayments, ...(data.payments || [])];
          }

          const auditLog = {
            id: crypto.randomUUID(),
            organizationId: orgId,
            branchId: targetBranch.id,
            userId: auth.user!.id,
            action: 'HISTORICAL_IMPORT',
            entity: entityType.toUpperCase(),
            entityId: targetBranch.id,
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || 'ODONTOPRO Historical Importer',
            oldValues: null,
            newValues: {
              entityType,
              totalRows: rows.length,
              imported: validCount,
              skipped: skippedCount,
              errors: errorCount,
              totalAmountPyg,
              createdPatients: newPatients.length,
              createdTreatments: newTreatments.length,
              createdPayments: newPayments.length,
            },
            description: `Carga masiva histórica (${entityType}): ${validCount} registro(s) importado(s), ${skippedCount} omitido(s), ${errorCount} con error en ${targetBranch.name}`,
            createdAt: nowIso,
          };
          data.auditLogs = [auditLog, ...(data.auditLogs || [])];

          const updatedTreatmentsList = Array.from(updatedTreatmentsMap.values());
          const upsertsPayload: Record<string, any[]> = {
            auditLogs: [auditLog],
          };
          if (newPatients.length > 0) upsertsPayload.patients = newPatients;
          if (newPatientBranches.length > 0) upsertsPayload.patientBranches = newPatientBranches;
          if (newTreatments.length > 0 || updatedTreatmentsList.length > 0) {
            upsertsPayload.treatments = [...newTreatments, ...updatedTreatmentsList];
          }
          if (newPayments.length > 0) upsertsPayload.payments = newPayments;

          const stateVersion = await saveDatabaseStateStrict({ upserts: upsertsPayload });

          return res.status(201).json({
            ...summaryPayload,
            committed: true,
            stateVersion,
            upserts: upsertsPayload,
          });
        } catch (persistErr) {
          data.patients = prevPatients;
          data.patientBranches = prevPatientBranches;
          data.treatments = prevTreatments;
          data.payments = prevPayments;
          data.auditLogs = prevAuditLogs;
          throw persistErr;
        }
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
