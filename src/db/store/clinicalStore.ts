import { hasPermission } from '../../security/rbacHierarchy.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import {
  evaluateCommissionsForEvent,
  getUserDisplayName,
  UNKNOWN_CREATOR_LABEL,
} from '../payrollEngine.ts';
import type { StoreContext } from './types.ts';
import { formatProfessionalName } from '../../utils/healthProfessional.ts';

function normalizeDocumentKey(val: unknown): string {
  return String(val || '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, '');
}

export function getPatients(ctx: StoreContext, branchId?: string, advisorId?: string | null) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  let orgPatients = data.patients.filter((p) => p.organizationId === orgId);
  if (branchId) {
    orgPatients = orgPatients.filter((p) => p.primaryBranchId === branchId);
  }
  if (advisorId === 'UNASSIGNED') {
    orgPatients = orgPatients.filter((p) => !p.assignedAdvisorId);
  } else if (advisorId) {
    orgPatients = orgPatients.filter((p) => p.assignedAdvisorId === advisorId);
  }
  return orgPatients;
}

export function getDentalChairs(ctx: StoreContext, branchId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  const orgChairs = (data.dentalChairs || []).filter((c) => c.organizationId === orgId);
  if (!branchId) return orgChairs;
  return orgChairs.filter((c) => c.branchId === branchId);
}

export function getAppointments(ctx: StoreContext, branchId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  const orgAppointments = data.appointments.filter((a) => a.organizationId === orgId);
  if (!branchId) return orgAppointments;
  return orgAppointments.filter((a) => a.branchId === branchId);
}

export function getClinicalRecords(ctx: StoreContext, patientId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  const orgRecords = (data.clinicalRecords || []).filter((cr) => cr.organizationId === orgId);
  if (!patientId) return orgRecords;
  return orgRecords.filter((cr) => cr.patientId === patientId);
}

export function getOdontograms(ctx: StoreContext, patientId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  const orgOdontograms = (data.odontograms || []).filter((o) => o.organizationId === orgId);
  if (!patientId) return orgOdontograms;
  return orgOdontograms.filter((o) => o.patientId === patientId);
}

export function getOdontogramItems(ctx: StoreContext, odontogramId?: string) {
  const data = ctx.getData();
  if (!odontogramId) return data.odontogramItems || [];
  return (data.odontogramItems || []).filter((oi) => oi.odontogramId === odontogramId);
}

export function updatePatient(
  ctx: StoreContext,
  patientId: string,
  updates: Record<string, any>,
  actorUserId?: string | null
) {
  const data = ctx.getData();
  const idx = data.patients.findIndex((p) => p.id === patientId);
  if (idx === -1) return null;

  const old = { ...data.patients[idx] };
  const effectiveActor = ctx.getEffectiveActor();
  const resolvedActorId = actorUserId || effectiveActor?.userId || data.users[0]?.id || null;

  const sanitizedUpdates: any = { ...updates };
  delete sanitizedUpdates.createdByUserId;
  delete sanitizedUpdates.createdByNameSnapshot;
  delete sanitizedUpdates.id;
  delete sanitizedUpdates.organizationId;

  const advisorChanged =
    sanitizedUpdates.assignedAdvisorId !== undefined &&
    sanitizedUpdates.assignedAdvisorId !== old.assignedAdvisorId;

  if (advisorChanged && effectiveActor && !hasPermission(effectiveActor, 'patients.assign_advisor')) {
    throw new Error('403 Prohibido: No posee permiso para asignar o reasignar el asesor comercial del paciente.');
  }

  if (sanitizedUpdates.documentNumber !== undefined) {
    const trimmedDoc = String(sanitizedUpdates.documentNumber).trim();
    const docKey = normalizeDocumentKey(trimmedDoc);
    if (!docKey) {
      throw new Error('Debe ingresar un número de documento válido.');
    }
    const duplicate = data.patients.find(
      (p) =>
        p.id !== patientId &&
        p.organizationId === old.organizationId &&
        normalizeDocumentKey(p.documentNumber) === docKey
    );
    if (duplicate) {
      throw new Error(
        `Ya existe otro paciente registrado con el documento ${duplicate.documentNumber} (${duplicate.firstName} ${duplicate.lastName}).`
      );
    }
    sanitizedUpdates.documentNumber = trimmedDoc;
  }

  if (sanitizedUpdates.email !== undefined) {
    sanitizedUpdates.email =
      sanitizedUpdates.email && String(sanitizedUpdates.email).trim()
        ? String(sanitizedUpdates.email).trim()
        : null;
  }
  if (sanitizedUpdates.birthDate !== undefined) {
    sanitizedUpdates.birthDate =
      sanitizedUpdates.birthDate && String(sanitizedUpdates.birthDate).trim()
        ? String(sanitizedUpdates.birthDate).trim()
        : null;
  }

  if (advisorChanged) {
    sanitizedUpdates.assignedAdvisorId = sanitizedUpdates.assignedAdvisorId || null;
    sanitizedUpdates.assignedAt = sanitizedUpdates.assignedAdvisorId ? new Date() : null;
    sanitizedUpdates.assignedByUserId = sanitizedUpdates.assignedAdvisorId ? resolvedActorId : null;
  }

  const updatedPatient = {
    ...old,
    ...sanitizedUpdates,
    updatedAt: new Date(),
  };
  data.patients = data.patients.map((p, i) => (i === idx ? updatedPatient : p));

  if (advisorChanged) {
    data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: data.organization.id,
      branchId: updatedPatient.primaryBranchId,
      userId: resolvedActorId,
      action: 'PATIENT_ADVISOR_CHANGED',
      entity: 'PATIENT',
      entityId: patientId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Client',
      oldValues: { assignedAdvisorId: old.assignedAdvisorId || null },
      newValues: { assignedAdvisorId: updatedPatient.assignedAdvisorId },
      description: `Cambio de Asesor Designado en paciente ${updatedPatient.firstName} ${updatedPatient.lastName}. No afecta comisiones históricas previas.`,
      createdAt: new Date(),
    });
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: updatedPatient.primaryBranchId,
    userId: resolvedActorId,
    action: 'UPDATE',
    entity: 'PATIENT',
    entityId: patientId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Client',
    oldValues: old,
    newValues: sanitizedUpdates,
    description: `Actualización de Ficha Clínica del paciente ${updatedPatient.firstName} ${updatedPatient.lastName} (C.I. ${updatedPatient.documentNumber})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return updatedPatient;
}

export function togglePatientStatus(ctx: StoreContext, patientId: string) {
  const data = ctx.getData();
  const idx = data.patients.findIndex((p) => p.id === patientId);
  if (idx === -1) return null;

  const pat = data.patients[idx];
  const effectiveActor = ctx.getEffectiveActor();
  const isCurrentlyActive = pat.status === 'ACTIVE' || pat.status === 'ACTIVO';
  const newStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
  const updatedPat = {
    ...pat,
    status: newStatus,
    updatedAt: new Date(),
  };
  data.patients = data.patients.map((p, i) => (i === idx ? updatedPat : p));

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: updatedPat.primaryBranchId,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'STATUS_CHANGE',
    entity: 'PATIENT',
    entityId: patientId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Client',
    oldValues: { status: pat.status },
    newValues: { status: newStatus },
    description: `Cambio de estado de ficha clínica para ${updatedPat.firstName} ${updatedPat.lastName} a ${newStatus}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return updatedPat;
}

export function addPatientVisit(ctx: StoreContext, patientId: string, branchId: string, visitDate?: string) {
  const data = ctx.getData();
  const targetDate = visitDate || getTodayAsuncionISO();
  const idx = data.patientBranches.findIndex((pb) => pb.patientId === patientId && pb.branchId === branchId);
  if (idx !== -1) {
    const existing = data.patientBranches[idx];
    const updated = {
      ...existing,
      firstVisitDate: !existing.firstVisitDate || targetDate < existing.firstVisitDate ? targetDate : existing.firstVisitDate,
      lastVisitDate: !existing.lastVisitDate || targetDate > existing.lastVisitDate ? targetDate : existing.lastVisitDate,
    };
    data.patientBranches = data.patientBranches.map((pb, i) => (i === idx ? updated : pb));
  } else {
    data.patientBranches = [
      ...data.patientBranches,
      {
        patientId,
        branchId,
        firstVisitDate: targetDate,
        lastVisitDate: targetDate,
      },
    ];
  }
  ctx.notify();
}

export function addPatient(
  ctx: StoreContext,
  newPatient: {
    documentNumber: string;
    documentType: string;
    firstName: string;
    lastName: string;
    phone: string;
    primaryBranchId: string;
    birthDate?: string | null;
    gender?: string;
    whatsapp?: string | null;
    email?: string | null;
    department?: string;
    city?: string;
    neighborhood?: string | null;
    address?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    bloodType?: string | null;
    allergies?: string;
    medicalConditions?: string;
    medications?: string;
    modality?: 'PARTICULAR' | 'PLAN_SEGURO';
    insurancePlanId?: string | null;
    insuranceMemberNumber?: string | null;
    assignedAdvisorId?: string | null;
    actorUserId?: string | null;
  }
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor();
  const creatorUserId = newPatient.actorUserId || effectiveActor?.userId || data.users[0]?.id || null;
  const creatorUser = creatorUserId ? data.users.find((u) => u.id === creatorUserId) : null;
  const creatorNameSnapshot = creatorUser ? getUserDisplayName(creatorUser) : UNKNOWN_CREATOR_LABEL;

  const trimmedDoc = String(newPatient.documentNumber || '').trim();
  const docKey = normalizeDocumentKey(trimmedDoc);
  if (!docKey) {
    throw new Error('Debe ingresar un número de documento válido.');
  }
  const duplicate = data.patients.find(
    (p) => p.organizationId === data.organization.id && normalizeDocumentKey(p.documentNumber) === docKey
  );
  if (duplicate) {
    throw new Error(
      `Ya existe un paciente registrado con el documento ${duplicate.documentNumber} (${duplicate.firstName} ${duplicate.lastName}).`
    );
  }

  const assignedAdvisorId: string | null = newPatient.assignedAdvisorId || null;
  if (assignedAdvisorId && effectiveActor && !hasPermission(effectiveActor, 'patients.assign_advisor')) {
    throw new Error('403 Prohibido: No posee permiso para designar un asesor comercial al paciente.');
  }

  const id = crypto.randomUUID();
  const todayPy = getTodayAsuncionISO();
  const trimmedPhone = String(newPatient.phone || '').trim();
  const patientRecord = {
    id,
    organizationId: data.organization.id,
    primaryBranchId: newPatient.primaryBranchId,
    documentType: newPatient.documentType || 'CI',
    documentNumber: trimmedDoc,
    firstName: String(newPatient.firstName || '').trim(),
    lastName: String(newPatient.lastName || '').trim(),
    birthDate: newPatient.birthDate && String(newPatient.birthDate).trim() ? String(newPatient.birthDate).trim() : null,
    gender: newPatient.gender || 'NO_ESPECIFICA',
    phone: trimmedPhone,
    whatsapp: newPatient.whatsapp && String(newPatient.whatsapp).trim() ? String(newPatient.whatsapp).trim() : trimmedPhone,
    email: newPatient.email && String(newPatient.email).trim() ? String(newPatient.email).trim() : null,
    department: newPatient.department || 'Central',
    city: newPatient.city || 'Asunción',
    neighborhood: newPatient.neighborhood && String(newPatient.neighborhood).trim() ? String(newPatient.neighborhood).trim() : null,
    address: newPatient.address && String(newPatient.address).trim() ? String(newPatient.address).trim() : null,
    emergencyContactName:
      newPatient.emergencyContactName && String(newPatient.emergencyContactName).trim()
        ? String(newPatient.emergencyContactName).trim()
        : null,
    emergencyContactPhone:
      newPatient.emergencyContactPhone && String(newPatient.emergencyContactPhone).trim()
        ? String(newPatient.emergencyContactPhone).trim()
        : null,
    bloodType: newPatient.bloodType && String(newPatient.bloodType).trim() ? String(newPatient.bloodType).trim() : null,
    allergies: newPatient.allergies && String(newPatient.allergies).trim() ? String(newPatient.allergies).trim() : 'Ninguna conocida',
    medicalConditions:
      newPatient.medicalConditions && String(newPatient.medicalConditions).trim()
        ? String(newPatient.medicalConditions).trim()
        : 'Ninguna',
    medications:
      newPatient.medications && String(newPatient.medications).trim()
        ? String(newPatient.medications).trim()
        : 'Ninguna',
    modality: newPatient.modality || 'PARTICULAR',
    insurancePlanId: newPatient.insurancePlanId || null,
    insuranceMemberNumber: newPatient.insuranceMemberNumber || null,
    assignedAdvisorId,
    assignedAt: assignedAdvisorId ? new Date() : null,
    assignedByUserId: assignedAdvisorId ? creatorUserId : null,
    createdByUserId: creatorUserId,
    createdByNameSnapshot: creatorNameSnapshot,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.patients = [patientRecord, ...data.patients];
  data.patientBranches = [
    ...data.patientBranches,
    {
      patientId: id,
      branchId: newPatient.primaryBranchId,
      firstVisitDate: todayPy,
      lastVisitDate: todayPy,
    },
  ];

  if (assignedAdvisorId) {
    evaluateCommissionsForEvent(data, {
      eventType: 'PATIENT_ACQUISITION',
      organizationId: data.organization.id,
      branchId: newPatient.primaryBranchId,
      patientId: id,
      amount: 0,
      actorUserId: creatorUserId,
    });
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: newPatient.primaryBranchId,
    userId: creatorUserId,
    action: 'CREATE',
    entity: 'PATIENT',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Client',
    oldValues: null,
    newValues: {
      firstName: patientRecord.firstName,
      lastName: patientRecord.lastName,
      doc: patientRecord.documentNumber,
      createdByUserId: creatorUserId,
      assignedAdvisorId,
    },
    description: `Registro de nuevo paciente ${patientRecord.firstName} ${patientRecord.lastName} (CI: ${patientRecord.documentNumber}) por ${creatorNameSnapshot}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return patientRecord;
}

export function recordPatientBranchVisit(ctx: StoreContext, patientId: string, branchId: string, visitDate?: string) {
  const data = ctx.getData();
  const targetDate = visitDate || getTodayAsuncionISO();
  const idx = data.patientBranches.findIndex((pb) => pb.patientId === patientId && pb.branchId === branchId);
  if (idx !== -1) {
    const existing = data.patientBranches[idx];
    const updated = {
      ...existing,
      firstVisitDate: !existing.firstVisitDate || targetDate < existing.firstVisitDate ? targetDate : existing.firstVisitDate,
      lastVisitDate: !existing.lastVisitDate || targetDate > existing.lastVisitDate ? targetDate : existing.lastVisitDate,
    };
    data.patientBranches = data.patientBranches.map((pb, i) => (i === idx ? updated : pb));
  } else {
    data.patientBranches = [
      ...data.patientBranches,
      {
        patientId,
        branchId,
        firstVisitDate: targetDate,
        lastVisitDate: targetDate,
      },
    ];
  }
}

export function checkDoubleBooking(
  ctx: StoreContext,
  params: {
    branchId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    odontologistId?: string;
    dentalChairId?: string;
    excludeAppointmentId?: string;
  }
): { hasConflict: boolean; reason?: string } {
  const data = ctx.getData();
  const settings = ctx.getBranchSettings(params.branchId);
  if (settings && settings.allowDoubleBooking) {
    return { hasConflict: false };
  }

  const startMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const newStart = startMinutes(params.startTime);
  const newEnd = startMinutes(params.endTime);

  const activeAppointments = data.appointments.filter((a) => {
    if (a.id === params.excludeAppointmentId) return false;
    if (a.branchId !== params.branchId) return false;
    if (a.appointmentDate !== params.appointmentDate) return false;
    if (a.status === 'CANCELADA' || a.status === 'NO_ASISTIO') return false;
    return true;
  });

  for (const existing of activeAppointments) {
    const exStart = startMinutes(existing.startTime);
    const exEnd = startMinutes(existing.endTime);

    const timesOverlap = newStart < exEnd && newEnd > exStart;
    if (timesOverlap) {
      if (params.odontologistId && existing.odontologistId === params.odontologistId) {
        const doc = data.users.find((u) => u.id === params.odontologistId);
        return {
          hasConflict: true,
          reason: `Conflicto de agenda: ${formatProfessionalName(doc, { fallback: 'El profesional' })} ya tiene una cita asignada de ${existing.startTime.slice(0, 5)} a ${existing.endTime.slice(0, 5)}.`,
        };
      }

      if (params.dentalChairId && existing.dentalChairId && existing.dentalChairId === params.dentalChairId) {
        const chair = (data.dentalChairs || []).find((c) => c.id === params.dentalChairId);
        return {
          hasConflict: true,
          reason: `Conflicto de sillón: El ${chair?.name || 'Sillón Seleccionado'} ya está ocupado en ese horario (${existing.startTime.slice(0, 5)} - ${existing.endTime.slice(0, 5)}).`,
        };
      }
    }
  }

  return { hasConflict: false };
}

export function addAppointment(
  ctx: StoreContext,
  appointment: {
    branchId: string;
    dentalChairId?: string;
    patientId: string;
    odontologistId: string;
    serviceId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    durationMin: number;
    reason: string;
    notes?: string;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  const conflictCheck = checkDoubleBooking(ctx, {
    branchId: appointment.branchId,
    appointmentDate: appointment.appointmentDate,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    odontologistId: appointment.odontologistId,
    dentalChairId: appointment.dentalChairId,
  });

  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.reason || 'Doble reserva detectada en el servidor.');
  }

  const effectiveActor = ctx.getEffectiveActor();
  const resolvedActorId = appointment.actorUserId || effectiveActor?.userId || data.users[0]?.id || null;

  const id = crypto.randomUUID();
  const record = {
    id,
    organizationId: data.organization.id,
    branchId: appointment.branchId,
    dentalChairId: appointment.dentalChairId || null,
    patientId: appointment.patientId,
    odontologistId: appointment.odontologistId,
    serviceId: appointment.serviceId,
    appointmentDate: appointment.appointmentDate,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    durationMin: appointment.durationMin,
    status: 'PENDIENTE',
    reason: appointment.reason,
    notes: appointment.notes || 'Turno registrado vía panel de agendamiento.',
    createdBy: resolvedActorId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.appointments = [record, ...data.appointments];
  recordPatientBranchVisit(ctx, appointment.patientId, appointment.branchId, appointment.appointmentDate);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: appointment.branchId,
    userId: resolvedActorId,
    action: 'CREATE',
    entity: 'APPOINTMENT',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Client',
    oldValues: null,
    newValues: record,
    description: `Agendamiento de turno odontológico para fecha ${appointment.appointmentDate} a las ${appointment.startTime.slice(0, 5)} hs (Zona America/Asuncion)`,
    createdAt: new Date(),
  });

  ctx.notify();
  return record;
}

export function updateAppointmentStatus(
  ctx: StoreContext,
  appointmentId: string,
  newStatus: 'PENDIENTE' | 'CONFIRMADA' | 'EN_SALA' | 'EN_ATENCION' | 'FINALIZADA' | 'CANCELADA' | 'NO_ASISTIO',
  cancellationReason?: string,
  actorUserId?: string
) {
  const data = ctx.getData();
  const idx = data.appointments.findIndex((a) => a.id === appointmentId);
  if (idx === -1) return null;

  const app = data.appointments[idx];
  const effectiveActor = ctx.getEffectiveActor();
  const resolvedActorId = actorUserId || effectiveActor?.userId || data.users[0]?.id || null;
  const oldStatus = app.status;
  const updatedApp = {
    ...app,
    status: newStatus,
    ...(cancellationReason ? { cancellationReason } : {}),
    updatedAt: new Date(),
  };
  data.appointments = data.appointments.map((a, i) => (i === idx ? updatedApp : a));

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: updatedApp.branchId,
    userId: resolvedActorId,
    action: 'STATUS_CHANGE',
    entity: 'APPOINTMENT',
    entityId: appointmentId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Client',
    oldValues: { status: oldStatus },
    newValues: { status: newStatus, cancellationReason },
    description: `Cambio de estado de turno a "${newStatus}"${cancellationReason ? ` (Motivo: ${cancellationReason})` : ''}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return updatedApp;
}

export function addClinicalRecord(
  ctx: StoreContext,
  record: {
    branchId: string;
    patientId: string;
    odontologistId: string;
    appointmentId?: string;
    recordDate?: string;
    reasonForConsultation: string;
    diagnosis: string;
    treatmentPerformed: string;
    prescriptions?: string;
    recommendations?: string;
    internalNotes?: string;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  const id = crypto.randomUUID();
  const todayPy = getTodayAsuncionISO();
  const rawRecordDate = record.recordDate ? String(record.recordDate).trim() : '';
  const effectiveRecordDate = /^\d{4}-\d{2}-\d{2}$/.test(rawRecordDate) ? rawRecordDate : todayPy;
  const createdAtDate =
    rawRecordDate && /^\d{4}-\d{2}-\d{2}$/.test(rawRecordDate) && rawRecordDate !== todayPy
      ? new Date(`${rawRecordDate}T16:00:00.000Z`)
      : new Date();
  const dentist = data.users.find((u) => u.id === record.odontologistId);

  const newRecord = {
    id,
    organizationId: data.organization.id,
    branchId: record.branchId,
    patientId: record.patientId,
    odontologistId: record.odontologistId,
    historicalDoctorName: dentist ? getUserDisplayName(dentist) : null,
    odontologistLicenseSnapshot: dentist?.professionalLicense || null,
    appointmentId: record.appointmentId || null,
    reasonForConsultation: record.reasonForConsultation,
    diagnosis: record.diagnosis,
    treatmentPerformed: record.treatmentPerformed,
    prescriptions: record.prescriptions || '',
    recommendations: record.recommendations || '',
    internalNotes: record.internalNotes || '',
    attachments: [],
    createdAt: createdAtDate,
    updatedAt: new Date(),
  };

  data.clinicalRecords = [newRecord, ...(data.clinicalRecords || [])];

  if (record.appointmentId) {
    data.appointments = (data.appointments || []).map((a) =>
      a.id === record.appointmentId && a.status !== 'FINALIZADA' && a.status !== 'CANCELADA'
        ? { ...a, status: 'FINALIZADA', updatedAt: new Date() }
        : a
    );
  }

  recordPatientBranchVisit(ctx, record.patientId, record.branchId, effectiveRecordDate);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: record.branchId,
    userId: record.actorUserId || record.odontologistId,
    action: 'CREATE',
    entity: 'CLINICAL_RECORD',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Clinical Workspace',
    oldValues: null,
    newValues: {
      diagnosis: record.diagnosis,
      treatment: record.treatmentPerformed,
      recordDate: effectiveRecordDate,
      dentistMSPBS: dentist?.professionalLicense || 'N/A',
    },
    description: `Registro de evolución y nota clínica (${effectiveRecordDate}) firmado por ${formatProfessionalName(dentist, { fallback: 'Odontólogo' })}${dentist?.professionalLicense ? ` (${dentist.professionalLicense})` : ''} - Ley 1682/01`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newRecord;
}

export function createOdontogramVersion(
  ctx: StoreContext,
  params: {
    patientId: string;
    odontologistId: string;
    odontogramType: 'ADULTO' | 'PEDIATRICO';
    generalObservations?: string;
    items?: Array<{
      toothNumber: number;
      surface: string;
      condition: string;
      material?: string;
      notes?: string;
      colorCode?: string;
    }>;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  if (!params.patientId) {
    throw new Error('Debe seleccionar un paciente válido para inicializar el odontograma.');
  }
  const existing = (data.odontograms || []).filter(
    (o) => o.patientId === params.patientId && o.odontogramType === params.odontogramType
  );
  const nextVersion = existing.length > 0 ? Math.max(...existing.map((o) => o.version || 1)) + 1 : 1;

  const id = crypto.randomUUID();
  const dentist = data.users.find((u) => u.id === params.odontologistId);
  const newOdontogram = {
    id,
    organizationId: data.organization.id,
    patientId: params.patientId,
    odontologistId: params.odontologistId,
    historicalDoctorName: dentist ? getUserDisplayName(dentist) : null,
    clinicalRecordId: null,
    version: nextVersion,
    odontogramType: params.odontogramType,
    generalObservations: params.generalObservations || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.odontograms = [newOdontogram, ...(data.odontograms || [])];

  const addedItems: any[] = [];
  if (params.items && params.items.length > 0) {
    params.items.forEach((it) => {
      addedItems.push({
        id: crypto.randomUUID(),
        odontogramId: id,
        toothNumber: it.toothNumber,
        surface: it.surface || 'GENERAL',
        condition: it.condition,
        material: it.material || null,
        notes: it.notes || '',
        colorCode: it.colorCode || '#EF4444',
        createdAt: new Date(),
      });
    });
  }
  data.odontogramItems = [...(data.odontogramItems || []), ...addedItems];

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: params.actorUserId || params.odontologistId,
    action: 'CREATE',
    entity: 'ODONTOGRAM',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro FDI Engine',
    oldValues: null,
    newValues: { version: nextVersion, type: params.odontogramType, itemsCount: params.items?.length || 0 },
    description: `Nueva versión v${nextVersion} de Odontograma (${params.odontogramType}) registrada por ${formatProfessionalName(dentist, { fallback: 'Tratante' })}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newOdontogram;
}

export function updateToothCondition(
  ctx: StoreContext,
  params: {
    odontogramId: string;
    toothNumber: number;
    surface: string;
    condition: string;
    material?: string;
    notes?: string;
    colorCode?: string;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  const currentItems = data.odontogramItems || [];

  const existingIndex = currentItems.findIndex(
    (item) =>
      item.odontogramId === params.odontogramId &&
      item.toothNumber === params.toothNumber &&
      item.surface === params.surface
  );

  let item: (typeof currentItems)[number] | undefined;
  if (params.condition === 'SANO' || params.condition === 'BORRAR') {
    if (existingIndex !== -1) {
      data.odontogramItems = currentItems.filter((_, idx) => idx !== existingIndex);
    }
  } else if (existingIndex !== -1) {
    item = {
      ...currentItems[existingIndex],
      condition: params.condition,
      material: params.material || null,
      notes: params.notes || '',
      colorCode: params.colorCode || '#EF4444',
    };
    data.odontogramItems = currentItems.map((it, idx) => (idx === existingIndex ? item : it));
  } else {
    item = {
      id: crypto.randomUUID(),
      odontogramId: params.odontogramId,
      toothNumber: params.toothNumber,
      surface: params.surface,
      condition: params.condition,
      material: params.material || null,
      notes: params.notes || '',
      colorCode: params.colorCode || '#EF4444',
      createdAt: new Date(),
    };
    data.odontogramItems = [...currentItems, item];
  }

  data.odontograms = (data.odontograms || []).map((o) =>
    o.id === params.odontogramId ? { ...o, updatedAt: new Date() } : o
  );

  ctx.notify();
  return item;
}
