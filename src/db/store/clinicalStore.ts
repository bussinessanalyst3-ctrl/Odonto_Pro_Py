import { hasPermission } from '../../security/rbacHierarchy.ts';
import {
  evaluateCommissionsForEvent,
  getUserDisplayName,
  UNKNOWN_CREATOR_LABEL,
} from '../payrollEngine.ts';
import type { StoreContext } from './types.ts';

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

  if (advisorChanged) {
    sanitizedUpdates.assignedAdvisorId = sanitizedUpdates.assignedAdvisorId || null;
    sanitizedUpdates.assignedAt = sanitizedUpdates.assignedAdvisorId ? new Date() : null;
    sanitizedUpdates.assignedByUserId = sanitizedUpdates.assignedAdvisorId ? resolvedActorId : null;
  }

  data.patients[idx] = {
    ...old,
    ...sanitizedUpdates,
    updatedAt: new Date(),
  };

  if (advisorChanged) {
    data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: data.organization.id,
      branchId: data.patients[idx].primaryBranchId,
      userId: resolvedActorId,
      action: 'PATIENT_ADVISOR_CHANGED',
      entity: 'PATIENT',
      entityId: patientId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Client',
      oldValues: { assignedAdvisorId: old.assignedAdvisorId || null },
      newValues: { assignedAdvisorId: data.patients[idx].assignedAdvisorId },
      description: `Cambio de Asesor Designado en paciente ${data.patients[idx].firstName} ${data.patients[idx].lastName}. No afecta comisiones históricas previas.`,
      createdAt: new Date(),
    });
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: data.patients[idx].primaryBranchId,
    userId: resolvedActorId,
    action: 'UPDATE',
    entity: 'PATIENT',
    entityId: patientId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Client',
    oldValues: old,
    newValues: sanitizedUpdates,
    description: `Actualización de Ficha Clínica del paciente ${data.patients[idx].firstName} ${data.patients[idx].lastName} (C.I. ${data.patients[idx].documentNumber})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return data.patients[idx];
}

export function togglePatientStatus(ctx: StoreContext, patientId: string) {
  const data = ctx.getData();
  const pat = data.patients.find((p) => p.id === patientId);
  if (!pat) return null;

  const newStatus = pat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  pat.status = newStatus;
  pat.updatedAt = new Date();

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: pat.primaryBranchId,
    userId: data.users[0]?.id || null,
    action: 'STATUS_CHANGE',
    entity: 'PATIENT',
    entityId: patientId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Client',
    oldValues: null,
    newValues: { status: newStatus },
    description: `Cambio de estado de ficha clínica para ${pat.firstName} ${pat.lastName} a ${newStatus}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return pat;
}

export function addPatientVisit(ctx: StoreContext, patientId: string, branchId: string) {
  const data = ctx.getData();
  const existing = data.patientBranches.find((pb) => pb.patientId === patientId && pb.branchId === branchId);
  const todayStr = new Date().toISOString().split('T')[0];
  if (existing) {
    existing.lastVisitDate = todayStr;
  } else {
    data.patientBranches.push({
      patientId,
      branchId,
      firstVisitDate: todayStr,
      lastVisitDate: todayStr,
    });
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
    department?: string;
    city?: string;
    allergies?: string;
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

  const assignedAdvisorId: string | null = newPatient.assignedAdvisorId || null;
  if (assignedAdvisorId && effectiveActor && !hasPermission(effectiveActor, 'patients.assign_advisor')) {
    throw new Error('403 Prohibido: No posee permiso para designar un asesor comercial al paciente.');
  }

  const id = crypto.randomUUID();
  const patientRecord = {
    id,
    organizationId: data.organization.id,
    primaryBranchId: newPatient.primaryBranchId,
    documentType: newPatient.documentType || 'CI',
    documentNumber: newPatient.documentNumber,
    firstName: newPatient.firstName,
    lastName: newPatient.lastName,
    birthDate: '1995-01-01',
    gender: 'NO_ESPECIFICA',
    phone: newPatient.phone,
    whatsapp: newPatient.phone,
    email: `${newPatient.firstName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
    department: newPatient.department || 'Central',
    city: newPatient.city || 'San Lorenzo',
    neighborhood: 'Centro',
    address: 'Calle principal',
    emergencyContactName: 'Familiar directo',
    emergencyContactPhone: newPatient.phone,
    bloodType: 'O+',
    allergies: newPatient.allergies || 'Ninguna conocida',
    medicalConditions: 'Ninguna',
    medications: 'Ninguna',
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

  data.patients.unshift(patientRecord);
  data.patientBranches.push({
    patientId: id,
    branchId: newPatient.primaryBranchId,
    firstVisitDate: new Date().toISOString().split('T')[0],
    lastVisitDate: new Date().toISOString().split('T')[0],
  });

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
      firstName: newPatient.firstName,
      lastName: newPatient.lastName,
      doc: newPatient.documentNumber,
      createdByUserId: creatorUserId,
      assignedAdvisorId,
    },
    description: `Registro de nuevo paciente ${newPatient.firstName} ${newPatient.lastName} (CI: ${newPatient.documentNumber}) por ${creatorNameSnapshot}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return patientRecord;
}

export function recordPatientBranchVisit(ctx: StoreContext, patientId: string, branchId: string) {
  const data = ctx.getData();
  const today = new Date().toISOString().split('T')[0];
  const existing = data.patientBranches.find((pb) => pb.patientId === patientId && pb.branchId === branchId);
  if (existing) {
    existing.lastVisitDate = today;
  } else {
    data.patientBranches.push({
      patientId,
      branchId,
      firstVisitDate: today,
      lastVisitDate: today,
    });
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
          reason: `Conflicto de agenda: El Dr(a). ${doc?.firstName || ''} ${doc?.lastName || ''} ya tiene una cita asignada de ${existing.startTime.slice(0, 5)} a ${existing.endTime.slice(0, 5)}.`,
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
    createdBy: appointment.actorUserId || data.users[3]?.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.appointments.unshift(record);
  ctx.recordPatientBranchVisit(appointment.patientId, appointment.branchId);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: appointment.branchId,
    userId: appointment.actorUserId || data.users[3]?.id,
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
  const app = data.appointments.find((a) => a.id === appointmentId);
  if (!app) return null;

  const oldStatus = app.status;
  app.status = newStatus;
  if (cancellationReason) {
    app.cancellationReason = cancellationReason;
  }
  app.updatedAt = new Date();

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: app.branchId,
    userId: actorUserId || data.users[3]?.id,
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
  return app;
}

export function addClinicalRecord(
  ctx: StoreContext,
  record: {
    branchId: string;
    patientId: string;
    odontologistId: string;
    appointmentId?: string;
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
  const newRecord = {
    id,
    organizationId: data.organization.id,
    branchId: record.branchId,
    patientId: record.patientId,
    odontologistId: record.odontologistId,
    appointmentId: record.appointmentId || null,
    reasonForConsultation: record.reasonForConsultation,
    diagnosis: record.diagnosis,
    treatmentPerformed: record.treatmentPerformed,
    prescriptions: record.prescriptions || '',
    recommendations: record.recommendations || '',
    internalNotes: record.internalNotes || '',
    attachments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!data.clinicalRecords) {
    data.clinicalRecords = [];
  }
  data.clinicalRecords.unshift(newRecord);

  if (record.appointmentId) {
    const app = data.appointments.find((a) => a.id === record.appointmentId);
    if (app && app.status !== 'FINALIZADA') {
      app.status = 'FINALIZADA';
      app.updatedAt = new Date();
    }
  }

  ctx.recordPatientBranchVisit(record.patientId, record.branchId);

  const dentist = data.users.find((u) => u.id === record.odontologistId);
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
      dentistMSPBS: dentist?.professionalLicense || 'N/A',
    },
    description: `Registro de evolución y nota clínica firmado por Dr(a). ${dentist?.firstName} ${dentist?.lastName} (${dentist?.professionalLicense || 'Sin Reg.'}) - Ley 1682/01`,
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
  const existing = (data.odontograms || []).filter(
    (o) => o.patientId === params.patientId && o.odontogramType === params.odontogramType
  );
  const nextVersion = existing.length > 0 ? Math.max(...existing.map((o) => o.version || 1)) + 1 : 1;

  const id = crypto.randomUUID();
  const newOdontogram = {
    id,
    organizationId: data.organization.id,
    patientId: params.patientId,
    odontologistId: params.odontologistId,
    clinicalRecordId: null,
    version: nextVersion,
    odontogramType: params.odontogramType,
    generalObservations: params.generalObservations || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!data.odontograms) {
    data.odontograms = [];
  }
  data.odontograms.unshift(newOdontogram);

  if (!data.odontogramItems) {
    data.odontogramItems = [];
  }

  if (params.items && params.items.length > 0) {
    params.items.forEach((it) => {
      data.odontogramItems.push({
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

  const dentist = data.users.find((u) => u.id === params.odontologistId);
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
    description: `Nueva versión v${nextVersion} de Odontograma (${params.odontogramType}) registrada por Dr(a). ${dentist?.firstName} ${dentist?.lastName}`,
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
  if (!data.odontogramItems) {
    data.odontogramItems = [];
  }

  const existingIndex = data.odontogramItems.findIndex(
    (item) =>
      item.odontogramId === params.odontogramId &&
      item.toothNumber === params.toothNumber &&
      item.surface === params.surface
  );

  let item;
  if (params.condition === 'SANO' || params.condition === 'BORRAR') {
    if (existingIndex !== -1) {
      data.odontogramItems.splice(existingIndex, 1);
    }
  } else if (existingIndex !== -1) {
    data.odontogramItems[existingIndex] = {
      ...data.odontogramItems[existingIndex],
      condition: params.condition,
      material: params.material || null,
      notes: params.notes || '',
      colorCode: params.colorCode || '#EF4444',
    };
    item = data.odontogramItems[existingIndex];
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
    data.odontogramItems.push(item);
  }

  const odon = data.odontograms.find((o) => o.id === params.odontogramId);
  if (odon) {
    odon.updatedAt = new Date();
  }

  ctx.notify();
  return item;
}
