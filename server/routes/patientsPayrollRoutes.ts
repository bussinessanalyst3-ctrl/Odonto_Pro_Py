import express from 'express';
import crypto from 'crypto';
import { hasPermission } from '../../src/security/rbacHierarchy.ts';
import {
  annulPayrollSettlementRecord,
  annulStaffPaymentRecord,
  approvePayrollSettlementRecord,
  computePayrollDashboardMetrics,
  createCommissionRuleRecord,
  createEmployeeRecord,
  createManualCommissionAdjustment,
  createPayrollSettlementRecord,
  ensurePayrollIntegrity,
  evaluateCommissionsForEvent,
  getUserDisplayName,
  listAdvisorEmployees,
  recordStaffPaymentRecord,
  submitSettlementForApprovalRecord,
  toggleEmployeeStatusRecord,
  UNKNOWN_CREATOR_LABEL,
  updateCommissionRuleRecord,
  updateEmployeeRecord,
  upsertEmployeeSalaryRecord,
} from '../../src/db/payrollEngine.ts';
import { getServerDbState, saveDatabaseState, saveDatabaseStateStrict } from '../stateStore.ts';
import { authenticateServerRequest, denyIfModuleNotAllowed } from '../security.ts';
import { getTodayAsuncionISO } from '../../src/config/appBrand.ts';

function normalizeDocumentKey(val: unknown): string {
  return String(val || '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, '');
}

export function createPatientsPayrollRouter(): express.Router {
  const router = express.Router();

  // =========================================================================
  // PACIENTES (TRAZABILIDAD COMERCIAL & INMUTABILIDAD DE CREADOR)
  // =========================================================================

  router.get('/patients', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'patients', 'GET /api/patients')) return;
    const serverDbState = getServerDbState();
    ensurePayrollIntegrity(serverDbState.data);
    const orgId =
      auth.actor.role === 'SUPER_ADMIN'
        ? String(req.query.organizationId || serverDbState.data.organization?.id || auth.actor.organizationId)
        : auth.actor.organizationId;

    const canViewAll =
      auth.actor.role === 'SUPER_ADMIN' ||
      hasPermission(auth.actor, 'patients.view') ||
      hasPermission(auth.actor, 'patients.view_basic') ||
      hasPermission(auth.actor, 'patients.manage');
    const canViewOwnPortfolio = hasPermission(auth.actor, 'patients.view_own_portfolio');

    if (!canViewAll && !canViewOwnPortfolio) {
      return res.status(403).json({ error: '403 Prohibido: No posee permisos para consultar pacientes.' });
    }

    let list = (serverDbState.data.patients || []).filter((p: any) => p.organizationId === orgId);

    if (!canViewAll && canViewOwnPortfolio) {
      const ownEmp = (serverDbState.data.employees || []).find(
        (e: any) => e.organizationId === orgId && e.userId === auth.user!.id
      );
      list = ownEmp ? list.filter((p: any) => p.assignedAdvisorId === ownEmp.id) : [];
    }

    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    if (branchId) list = list.filter((p: any) => p.primaryBranchId === branchId);

    const assignedAdvisorId = req.query.assignedAdvisorId ? String(req.query.assignedAdvisorId) : null;
    if (assignedAdvisorId === 'UNASSIGNED') {
      list = list.filter((p: any) => !p.assignedAdvisorId);
    } else if (assignedAdvisorId) {
      list = list.filter((p: any) => p.assignedAdvisorId === assignedAdvisorId);
    }

    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';
    if (search) {
      list = list.filter(
        (p: any) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(search) ||
          (p.documentNumber || '').toLowerCase().includes(search) ||
          (p.phone || '').toLowerCase().includes(search)
      );
    }

    return res.json({ patients: list });
  });

  router.post('/patients', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'patients', 'POST /api/patients')) return;
      if (!hasPermission(auth.actor, 'patients.manage')) {
        return res.status(403).json({ error: '403 Prohibido: No posee permiso para registrar pacientes.' });
      }

      const body = req.body || {};
      if (!body.firstName?.trim() || !body.lastName?.trim() || !body.documentNumber?.trim() || !body.phone?.trim()) {
        return res.status(400).json({ error: 'Nombre, apellido, documento y teléfono son obligatorios.' });
      }

      let assignedAdvisorId: string | null = body.assignedAdvisorId ? String(body.assignedAdvisorId) : null;
      if (assignedAdvisorId && !hasPermission(auth.actor, 'patients.assign_advisor')) {
        return res.status(403).json({ error: '403 Prohibido: No tiene permiso para designar asesor comercial.' });
      }

      const serverDbState = getServerDbState();
      ensurePayrollIntegrity(serverDbState.data);
      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? body.organizationId || serverDbState.data.organization?.id || auth.actor.organizationId
          : auth.actor.organizationId;

      if (assignedAdvisorId) {
        const advisor = (serverDbState.data.employees || []).find(
          (e: any) => e.id === assignedAdvisorId && e.organizationId === orgId && e.status === 'ACTIVE' && e.isAdvisor
        );
        if (!advisor) {
          return res.status(400).json({ error: 'El asesor comercial seleccionado no existe o está inactivo.' });
        }
      }

      const normalizedDocKey = normalizeDocumentKey(body.documentNumber);
      if (!normalizedDocKey) {
        return res.status(400).json({ error: 'Debe ingresar un número de documento válido.' });
      }
      const duplicatePatient = (serverDbState.data.patients || []).find(
        (p: any) =>
          p.organizationId === orgId &&
          normalizeDocumentKey(p.documentNumber) === normalizedDocKey
      );
      if (duplicatePatient) {
        return res.status(409).json({
          error: `Ya existe un paciente registrado con el documento ${duplicatePatient.documentNumber} (${duplicatePatient.firstName} ${duplicatePatient.lastName}).`,
          code: 'DUPLICATE_PATIENT_DOCUMENT',
        });
      }

      const createdByUserId = auth.user.id;
      const createdByNameSnapshot = getUserDisplayName(auth.user);
      const patientId = crypto.randomUUID();
      const branchId = body.primaryBranchId || serverDbState.data.branches?.[0]?.id;
      const nowIso = new Date().toISOString();
      const todayPy = getTodayAsuncionISO();

      const record = {
        id: patientId,
        organizationId: orgId,
        primaryBranchId: branchId,
        documentType: String(body.documentType || 'CI').trim(),
        documentNumber: String(body.documentNumber).trim(),
        firstName: String(body.firstName).trim(),
        lastName: String(body.lastName).trim(),
        birthDate: body.birthDate ? String(body.birthDate).trim() : null,
        gender: body.gender ? String(body.gender).trim() : 'NO_ESPECIFICA',
        phone: String(body.phone).trim(),
        whatsapp: body.whatsapp ? String(body.whatsapp).trim() : String(body.phone).trim(),
        email: body.email && String(body.email).trim() ? String(body.email).trim() : null,
        department: body.department ? String(body.department).trim() : 'Central',
        city: body.city ? String(body.city).trim() : 'Asunción',
        neighborhood: body.neighborhood ? String(body.neighborhood).trim() : null,
        address: body.address ? String(body.address).trim() : null,
        emergencyContactName: body.emergencyContactName ? String(body.emergencyContactName).trim() : null,
        emergencyContactPhone: body.emergencyContactPhone ? String(body.emergencyContactPhone).trim() : null,
        bloodType: body.bloodType ? String(body.bloodType).trim() : null,
        allergies: body.allergies && String(body.allergies).trim() ? String(body.allergies).trim() : 'Ninguna conocida',
        medicalConditions: body.medicalConditions && String(body.medicalConditions).trim() ? String(body.medicalConditions).trim() : 'Ninguna',
        medications: body.medications && String(body.medications).trim() ? String(body.medications).trim() : 'Ninguna',
        modality: body.modality || 'PARTICULAR',
        insurancePlanId: body.insurancePlanId || null,
        insuranceMemberNumber: body.insuranceMemberNumber ? String(body.insuranceMemberNumber).trim() : null,
        assignedAdvisorId,
        assignedAt: assignedAdvisorId ? nowIso : null,
        assignedByUserId: assignedAdvisorId ? auth.user.id : null,
        createdByUserId,
        createdByNameSnapshot,
        status: 'ACTIVE',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const auditCountBefore = serverDbState.data.auditLogs.length;
      const patientBranchRecord = {
        patientId,
        branchId,
        firstVisitDate: todayPy,
        lastVisitDate: todayPy,
      };

      serverDbState.data.patients = [record, ...(serverDbState.data.patients || [])];
      serverDbState.data.patientBranches = [...(serverDbState.data.patientBranches || []), patientBranchRecord];

      let generatedComms: any[] = [];
      if (assignedAdvisorId) {
        generatedComms = evaluateCommissionsForEvent(serverDbState.data, {
          eventType: 'PATIENT_ACQUISITION',
          organizationId: orgId,
          branchId,
          patientId,
          amount: 0,
          actorUserId: auth.user.id,
        });
      }

      serverDbState.data.auditLogs.unshift({
        id: crypto.randomUUID(),
        organizationId: orgId,
        branchId,
        userId: auth.user.id,
        action: 'CREATE',
        entity: 'PATIENT',
        entityId: patientId,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues: null,
        newValues: { createdByUserId, assignedAdvisorId, documentNumber: record.documentNumber },
        description: `Alta de paciente ${record.firstName} ${record.lastName} por ${createdByNameSnapshot}`,
        createdAt: nowIso,
      });

      const newAuditLogs = serverDbState.data.auditLogs.slice(0, serverDbState.data.auditLogs.length - auditCountBefore);
      const stateVersion = await saveDatabaseStateStrict({
        upserts: {
          patients: [record],
          patientBranches: [patientBranchRecord],
          ...(generatedComms.length > 0 ? { generatedCommissions: generatedComms } : {}),
          auditLogs: newAuditLogs,
        },
      });
      return res.status(201).json({
        patient: record,
        patientBranch: patientBranchRecord,
        auditLogs: newAuditLogs,
        stateVersion,
      });
    } catch (err) {
      return next(err);
    }
  });

  router.put('/patients/:id', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.actor || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
      }
      if (denyIfModuleNotAllowed(auth, res, 'patients', 'PUT /api/patients/:id')) return;
      const serverDbState = getServerDbState();
      ensurePayrollIntegrity(serverDbState.data);

      const { id } = req.params;
      const idx = (serverDbState.data.patients || []).findIndex((p: any) => p.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Paciente no encontrado.' });

      const current = serverDbState.data.patients[idx];
      if (auth.actor.role !== 'SUPER_ADMIN' && current.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa.' });
      }

      const body = { ...(req.body || {}) };
      const canManagePatients = hasPermission(auth.actor, 'patients.manage');
      const canAssignAdvisor = hasPermission(auth.actor, 'patients.assign_advisor');

      const advisorChanged = body.assignedAdvisorId !== undefined && body.assignedAdvisorId !== current.assignedAdvisorId;

      if (!canManagePatients && !(advisorChanged && canAssignAdvisor)) {
        return res.status(403).json({ error: '403 Prohibido: No posee permisos para modificar esta ficha.' });
      }
      if (advisorChanged && !canAssignAdvisor) {
        return res.status(403).json({
          error: '403 Prohibido: No posee permiso para modificar el asesor comercial designado.',
        });
      }

      delete body.createdByUserId;
      delete body.createdByNameSnapshot;
      delete body.id;
      delete body.organizationId;

      if (body.documentNumber !== undefined) {
        const trimmedDoc = String(body.documentNumber).trim();
        const normalizedDocKey = normalizeDocumentKey(trimmedDoc);
        if (!normalizedDocKey) {
          return res.status(400).json({ error: 'Debe ingresar un número de documento válido.' });
        }
        const duplicatePatient = (serverDbState.data.patients || []).find(
          (p: any) =>
            p.id !== id &&
            p.organizationId === current.organizationId &&
            normalizeDocumentKey(p.documentNumber) === normalizedDocKey
        );
        if (duplicatePatient) {
          return res.status(409).json({
            error: `Ya existe otro paciente registrado con el documento ${duplicatePatient.documentNumber} (${duplicatePatient.firstName} ${duplicatePatient.lastName}).`,
            code: 'DUPLICATE_PATIENT_DOCUMENT',
          });
        }
        body.documentNumber = trimmedDoc;
      }

      if (body.firstName !== undefined) body.firstName = String(body.firstName).trim();
      if (body.lastName !== undefined) body.lastName = String(body.lastName).trim();
      if (body.phone !== undefined) body.phone = String(body.phone).trim();
      if (body.email !== undefined) body.email = body.email && String(body.email).trim() ? String(body.email).trim() : null;
      if (body.birthDate !== undefined) body.birthDate = body.birthDate && String(body.birthDate).trim() ? String(body.birthDate).trim() : null;

      if (advisorChanged) {
        if (body.assignedAdvisorId) {
          const advisor = (serverDbState.data.employees || []).find(
            (e: any) =>
              e.id === body.assignedAdvisorId &&
              e.organizationId === current.organizationId &&
              e.status === 'ACTIVE' &&
              e.isAdvisor
          );
          if (!advisor) {
            return res.status(400).json({ error: 'El asesor comercial designado no existe o está inactivo.' });
          }
        }
        body.assignedAdvisorId = body.assignedAdvisorId || null;
        body.assignedAt = body.assignedAdvisorId ? new Date().toISOString() : null;
        body.assignedByUserId = body.assignedAdvisorId ? auth.user.id : null;
      }

      const nowIso = new Date().toISOString();
      const updated = {
        ...current,
        ...body,
        createdByUserId: current.createdByUserId ?? null,
        createdByNameSnapshot: current.createdByNameSnapshot || UNKNOWN_CREATOR_LABEL,
        updatedAt: nowIso,
      };
      serverDbState.data.patients = serverDbState.data.patients.map((p: any, i: number) =>
        i === idx ? updated : p
      );

      const newAuditLogs: any[] = [];
      if (advisorChanged) {
        const advisorLog = {
          id: crypto.randomUUID(),
          organizationId: current.organizationId,
          branchId: updated.primaryBranchId,
          userId: auth.user.id,
          action: 'PATIENT_ADVISOR_CHANGED',
          entity: 'PATIENT',
          entityId: id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Backend API',
          oldValues: { assignedAdvisorId: current.assignedAdvisorId || null },
          newValues: { assignedAdvisorId: updated.assignedAdvisorId },
          description: `Cambio de asesor comercial en ficha de ${updated.firstName} ${updated.lastName} sin alterar comisiones históricas.`,
          createdAt: nowIso,
        };
        serverDbState.data.auditLogs.unshift(advisorLog);
        newAuditLogs.push(advisorLog);
      }

      const updateLog = {
        id: crypto.randomUUID(),
        organizationId: current.organizationId,
        branchId: updated.primaryBranchId,
        userId: auth.user.id,
        action: body.status && body.status !== current.status && Object.keys(body).length === 1 ? 'STATUS_CHANGE' : 'UPDATE',
        entity: 'PATIENT',
        entityId: id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues: {
          firstName: current.firstName,
          lastName: current.lastName,
          documentNumber: current.documentNumber,
          phone: current.phone,
          status: current.status,
        },
        newValues: body,
        description: `Actualización de ficha clínica de ${updated.firstName} ${updated.lastName} (C.I. ${updated.documentNumber})`,
        createdAt: nowIso,
      };
      serverDbState.data.auditLogs.unshift(updateLog);
      newAuditLogs.push(updateLog);

      const stateVersion = await saveDatabaseStateStrict({
        upserts: {
          patients: [updated],
          auditLogs: newAuditLogs,
        },
      });
      return res.json({ patient: updated, auditLogs: newAuditLogs, stateVersion });
    } catch (err) {
      return next(err);
    }
  });

  // =========================================================================
  // MÓDULO: GESTIÓN FINANCIERA DEL PERSONAL, SALARIOS Y COMISIONES
  // =========================================================================

  router.get('/payroll/advisors', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, ['staff-payroll', 'patients', 'quotes'], 'GET /api/payroll/advisors')) return;
    const serverDbState = getServerDbState();
    const orgId =
      auth.actor.role === 'SUPER_ADMIN'
        ? String(req.query.organizationId || serverDbState.data.organization?.id || auth.actor.organizationId)
        : auth.actor.organizationId;
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    return res.json({ advisors: listAdvisorEmployees(serverDbState.data, orgId, branchId) });
  });

  router.get('/payroll/overview', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'GET /api/payroll/overview')) return;
    const serverDbState = getServerDbState();
    ensurePayrollIntegrity(serverDbState.data);

    const orgId =
      auth.actor.role === 'SUPER_ADMIN'
        ? String(req.query.organizationId || serverDbState.data.organization?.id || auth.actor.organizationId)
        : auth.actor.organizationId;

    const canViewAllStaff =
      auth.actor.role === 'SUPER_ADMIN' ||
      hasPermission(auth.actor, 'staff.view') ||
      hasPermission(auth.actor, 'commissions.view_all');
    const canViewOwn = hasPermission(auth.actor, 'commissions.view_own');

    if (!canViewAllStaff && !canViewOwn) {
      return res.status(403).json({
        error: '403 Prohibido: No tiene autorización para consultar información financiera del personal.',
      });
    }

    const ownEmp = (serverDbState.data.employees || []).find(
      (e: any) => e.organizationId === orgId && e.userId === auth.user!.id
    );

    const employees = (serverDbState.data.employees || []).filter((e: any) => {
      if (e.organizationId !== orgId) return false;
      if (!canViewAllStaff && canViewOwn) return ownEmp ? e.id === ownEmp.id : false;
      return true;
    });
    const allowedEmpIds = new Set(employees.map((e: any) => e.id));

    const canViewSalaries =
      auth.actor.role === 'SUPER_ADMIN' || hasPermission(auth.actor, 'salaries.view') || canViewOwn;
    const salaries = canViewSalaries
      ? (serverDbState.data.employeeSalaries || []).filter((s: any) => allowedEmpIds.has(s.employeeId))
      : [];

    const commissionRules = canViewAllStaff
      ? (serverDbState.data.commissionRules || []).filter((r: any) => r.organizationId === orgId)
      : [];

    const generatedCommissions = (serverDbState.data.generatedCommissions || []).filter((c: any) =>
      allowedEmpIds.has(c.employeeId)
    );
    const payrollSettlements = (serverDbState.data.payrollSettlements || []).filter((s: any) =>
      allowedEmpIds.has(s.employeeId)
    );
    const settlementIds = new Set(payrollSettlements.map((s: any) => s.id));
    const payrollSettlementItems = (serverDbState.data.payrollSettlementItems || []).filter((i: any) =>
      settlementIds.has(i.settlementId)
    );
    const staffPayments = (serverDbState.data.staffPayments || []).filter((p: any) =>
      allowedEmpIds.has(p.employeeId)
    );

    const metrics = computePayrollDashboardMetrics(serverDbState.data, {
      organizationId: orgId,
      employeeId: !canViewAllStaff && canViewOwn ? ownEmp?.id || '__none__' : null,
    });

    return res.json({
      scope: canViewAllStaff ? 'ORGANIZATION' : 'OWN',
      employees,
      salaries,
      commissionRules,
      generatedCommissions,
      payrollSettlements,
      payrollSettlementItems,
      staffPayments,
      metrics,
    });
  });

  router.post('/payroll/employees', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/employees')) return;
    if (!hasPermission(auth.actor, 'staff.manage')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso staff.manage.' });
    }
    try {
      const serverDbState = getServerDbState();
      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? req.body?.organizationId || serverDbState.data.organization?.id || auth.actor.organizationId
          : auth.actor.organizationId;
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const employee = createEmployeeRecord(
        serverDbState.data,
        { ...req.body, organizationId: orgId },
        auth.user.id
      );
      let initialSalaryRecord: any = null;
      if (req.body?.initialSalary && Number(req.body.initialSalary) > 0) {
        if (!hasPermission(auth.actor, 'salaries.manage')) {
          return res.status(403).json({ error: '403 Prohibido: No posee permiso salaries.manage.' });
        }
        initialSalaryRecord = upsertEmployeeSalaryRecord(
          serverDbState.data,
          {
            employeeId: employee.id,
            baseSalary: Number(req.body.initialSalary),
            paymentFrequency: req.body.paymentFrequency || 'MENSUAL',
            effectiveDate: employee.hireDate,
            observations: 'Salario inicial al crear ficha de empleado',
          },
          auth.user.id
        );
      }
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          employees: [employee],
          ...(initialSalaryRecord ? { employeeSalaries: [initialSalaryRecord] } : {}),
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.status(201).json({ employee });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.put('/payroll/employees/:id', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'PUT /api/payroll/employees/:id')) return;
    if (!hasPermission(auth.actor, 'staff.manage')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso staff.manage.' });
    }
    try {
      const serverDbState = getServerDbState();
      const emp = (serverDbState.data.employees || []).find((e: any) => e.id === req.params.id);
      if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });
      if (auth.actor.role !== 'SUPER_ADMIN' && emp.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const updated = updateEmployeeRecord(serverDbState.data, req.params.id, req.body || {}, auth.user.id);
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          employees: [updated],
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json({ employee: updated });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.patch('/payroll/employees/:id/status', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'PATCH /api/payroll/employees/:id/status')) return;
    if (!hasPermission(auth.actor, 'staff.manage')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso staff.manage.' });
    }
    try {
      const serverDbState = getServerDbState();
      const emp = (serverDbState.data.employees || []).find((e: any) => e.id === req.params.id);
      if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });
      if (auth.actor.role !== 'SUPER_ADMIN' && emp.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const updated = toggleEmployeeStatusRecord(serverDbState.data, req.params.id, req.body?.status, auth.user.id);
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          employees: [updated],
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json({ employee: updated });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/salaries', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/salaries')) return;
    if (!hasPermission(auth.actor, 'salaries.manage')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso salaries.manage.' });
    }
    try {
      const serverDbState = getServerDbState();
      const emp = (serverDbState.data.employees || []).find((e: any) => e.id === req.body?.employeeId);
      if (emp && auth.actor.role !== 'SUPER_ADMIN' && emp.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const previousActive = (serverDbState.data.employeeSalaries || []).find(
        (s: any) => s.employeeId === req.body?.employeeId && s.status === 'VIGENTE'
      );
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const salary = upsertEmployeeSalaryRecord(serverDbState.data, req.body || {}, auth.user.id);
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      const upsertedSalaries = previousActive ? [salary, previousActive] : [salary];
      await saveDatabaseState({
        upserts: {
          employeeSalaries: upsertedSalaries,
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.status(201).json({ salary });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/commission-rules', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/commission-rules')) return;
    if (!hasPermission(auth.actor, 'commissions.rules_manage')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso commissions.rules_manage.' });
    }
    try {
      const serverDbState = getServerDbState();
      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? req.body?.organizationId || serverDbState.data.organization?.id || auth.actor.organizationId
          : auth.actor.organizationId;
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const rule = createCommissionRuleRecord(
        serverDbState.data,
        { ...req.body, organizationId: orgId },
        auth.user.id
      );
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          commissionRules: [rule],
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.status(201).json({ rule });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.put('/payroll/commission-rules/:id', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'PUT /api/payroll/commission-rules/:id')) return;
    if (!hasPermission(auth.actor, 'commissions.rules_manage')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso commissions.rules_manage.' });
    }
    try {
      const serverDbState = getServerDbState();
      const existing = (serverDbState.data.commissionRules || []).find((r: any) => r.id === req.params.id);
      if (existing && auth.actor.role !== 'SUPER_ADMIN' && existing.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const rule = updateCommissionRuleRecord(serverDbState.data, req.params.id, req.body || {}, auth.user.id);
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          commissionRules: [rule],
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json({ rule });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.patch('/payroll/commission-rules/:id/status', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'PATCH /api/payroll/commission-rules/:id/status')) return;
    if (!hasPermission(auth.actor, 'commissions.rules_manage')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso commissions.rules_manage.' });
    }
    try {
      const serverDbState = getServerDbState();
      const existing = (serverDbState.data.commissionRules || []).find((r: any) => r.id === req.params.id);
      if (existing && auth.actor.role !== 'SUPER_ADMIN' && existing.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const rule = updateCommissionRuleRecord(
        serverDbState.data,
        req.params.id,
        { status: req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
        auth.user.id
      );
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          commissionRules: [rule],
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json({ rule });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/commissions/evaluate', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/commissions/evaluate')) return;
    if (!hasPermission(auth.actor, 'payroll.create') && !hasPermission(auth.actor, 'commissions.rules_manage')) {
      return res.status(403).json({ error: '403 Prohibido: Permiso insuficiente para evaluar comisiones.' });
    }
    try {
      const serverDbState = getServerDbState();
      const orgId =
        auth.actor.role === 'SUPER_ADMIN'
          ? req.body?.organizationId || serverDbState.data.organization?.id || auth.actor.organizationId
          : auth.actor.organizationId;
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const generated = evaluateCommissionsForEvent(serverDbState.data, {
        ...req.body,
        organizationId: orgId,
        actorUserId: auth.user.id,
      });
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      if (generated.length > 0 || newAuditLogs.length > 0) {
        await saveDatabaseState({
          upserts: {
            ...(generated.length > 0 ? { generatedCommissions: generated } : {}),
            ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
          },
        });
      }
      return res.json({ generated });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/commissions/manual', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/commissions/manual')) return;
    if (!hasPermission(auth.actor, 'payroll.create') && !hasPermission(auth.actor, 'commissions.rules_manage')) {
      return res.status(403).json({
        error: '403 Prohibido: Permiso insuficiente para bonos o comisiones manuales.',
      });
    }
    try {
      const serverDbState = getServerDbState();
      const emp = (serverDbState.data.employees || []).find((e: any) => e.id === req.body?.employeeId);
      if (emp && auth.actor.role !== 'SUPER_ADMIN' && emp.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const commission = createManualCommissionAdjustment(serverDbState.data, req.body || {}, auth.user.id);
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          generatedCommissions: [commission],
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.status(201).json({ commission });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/settlements', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/settlements')) return;
    if (!hasPermission(auth.actor, 'payroll.create')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso payroll.create.' });
    }
    try {
      const serverDbState = getServerDbState();
      const emp = (serverDbState.data.employees || []).find((e: any) => e.id === req.body?.employeeId);
      if (emp && auth.actor.role !== 'SUPER_ADMIN' && emp.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const result = createPayrollSettlementRecord(serverDbState.data, req.body || {}, auth.user.id);
      const attachedCommissions = (serverDbState.data.generatedCommissions || []).filter(
        (c: any) => c.settlementId === result.settlement.id
      );
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          payrollSettlements: [result.settlement],
          ...(result.items.length > 0 ? { payrollSettlementItems: result.items } : {}),
          ...(attachedCommissions.length > 0 ? { generatedCommissions: attachedCommissions } : {}),
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/settlements/:id/submit', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/settlements/:id/submit')) return;
    if (!hasPermission(auth.actor, 'payroll.create')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso payroll.create.' });
    }
    try {
      const serverDbState = getServerDbState();
      const existing = (serverDbState.data.payrollSettlements || []).find((s: any) => s.id === req.params.id);
      if (existing && auth.actor.role !== 'SUPER_ADMIN' && existing.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const settlement = submitSettlementForApprovalRecord(serverDbState.data, req.params.id, auth.user.id);
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          payrollSettlements: [settlement],
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json({ settlement });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/settlements/:id/approve', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/settlements/:id/approve')) return;
    if (!hasPermission(auth.actor, 'payroll.approve')) {
      return res.status(403).json({
        error: '403 Prohibido: Solo usuarios con permiso payroll.approve pueden aprobar liquidaciones.',
      });
    }
    try {
      const serverDbState = getServerDbState();
      const existing = (serverDbState.data.payrollSettlements || []).find((s: any) => s.id === req.params.id);
      if (existing && auth.actor.role !== 'SUPER_ADMIN' && existing.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const settlement = approvePayrollSettlementRecord(serverDbState.data, req.params.id, auth.user.id);
      const linkedCommissions = (serverDbState.data.generatedCommissions || []).filter(
        (c: any) => c.settlementId === settlement.id
      );
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          payrollSettlements: [settlement],
          ...(linkedCommissions.length > 0 ? { generatedCommissions: linkedCommissions } : {}),
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json({ settlement });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/settlements/:id/annul', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/settlements/:id/annul')) return;
    if (!hasPermission(auth.actor, 'payroll.approve') && !hasPermission(auth.actor, 'payroll.create')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso para anular liquidaciones.' });
    }
    try {
      const serverDbState = getServerDbState();
      const existing = (serverDbState.data.payrollSettlements || []).find((s: any) => s.id === req.params.id);
      if (existing && auth.actor.role !== 'SUPER_ADMIN' && existing.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const linkedCommissionsBefore = (serverDbState.data.generatedCommissions || []).filter(
        (c: any) => c.settlementId === req.params.id && c.status !== 'ANULADA'
      );
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const settlement = annulPayrollSettlementRecord(
        serverDbState.data,
        req.params.id,
        req.body?.reason || '',
        auth.user.id
      );
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          payrollSettlements: [settlement],
          ...(linkedCommissionsBefore.length > 0 ? { generatedCommissions: linkedCommissionsBefore } : {}),
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json({ settlement });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/payments', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/payments')) return;
    if (!hasPermission(auth.actor, 'payroll.pay')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso payroll.pay.' });
    }
    try {
      const canOverrideBalance = hasPermission(auth.actor, 'payroll.override_balance');
      if (req.body?.overpaymentOverride && !canOverrideBalance) {
        return res.status(403).json({
          error: '403 Prohibido: No posee permiso payroll.override_balance para autorizar excedentes.',
        });
      }
      const serverDbState = getServerDbState();
      const existing = (serverDbState.data.payrollSettlements || []).find(
        (s: any) => s.id === req.body?.settlementId
      );
      if (existing && auth.actor.role !== 'SUPER_ADMIN' && existing.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const result = recordStaffPaymentRecord(
        serverDbState.data,
        {
          ...req.body,
          canOverrideBalance,
          responsibleUserName: getUserDisplayName(auth.user),
        },
        auth.user.id
      );
      const linkedCommissions = (serverDbState.data.generatedCommissions || []).filter(
        (c: any) => c.settlementId === result.settlement.id
      );
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          staffPayments: [result.payment],
          payrollSettlements: [result.settlement],
          ...(linkedCommissions.length > 0 ? { generatedCommissions: linkedCommissions } : {}),
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/payroll/payments/:id/annul', async (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || 'No autorizado' });
    }
    if (denyIfModuleNotAllowed(auth, res, 'staff-payroll', 'POST /api/payroll/payments/:id/annul')) return;
    if (!hasPermission(auth.actor, 'payroll.pay') && !hasPermission(auth.actor, 'payroll.approve')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso para anular pagos al personal.' });
    }
    try {
      const serverDbState = getServerDbState();
      const existing = (serverDbState.data.staffPayments || []).find((p: any) => p.id === req.params.id);
      if (existing && auth.actor.role !== 'SUPER_ADMIN' && existing.organizationId !== auth.actor.organizationId) {
        return res.status(403).json({ error: '403 Prohibido: Violación multiempresa.' });
      }
      const auditCountBefore = (serverDbState.data.auditLogs || []).length;
      const result = annulStaffPaymentRecord(
        serverDbState.data,
        req.params.id,
        req.body?.reason || '',
        auth.user.id
      );
      const linkedCommissions = (serverDbState.data.generatedCommissions || []).filter(
        (c: any) => c.settlementId === result.settlement.id
      );
      const newAuditLogs = (serverDbState.data.auditLogs || []).slice(
        0,
        (serverDbState.data.auditLogs || []).length - auditCountBefore
      );
      await saveDatabaseState({
        upserts: {
          staffPayments: [result.payment],
          payrollSettlements: [result.settlement],
          ...(linkedCommissions.length > 0 ? { generatedCommissions: linkedCommissions } : {}),
          ...(newAuditLogs.length > 0 ? { auditLogs: newAuditLogs } : {}),
        },
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}
