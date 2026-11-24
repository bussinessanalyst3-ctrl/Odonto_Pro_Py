import { STANDARD_SERVICES, formatPYG, validatePygPrice } from '../seeds/paraguay-catalogs.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import {
  evaluateCommissionsForEvent,
  reverseCommissionsForAnnulledPayment,
} from '../payrollEngine.ts';
import type { StoreContext } from './types.ts';

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().split('T')[0];
}

export function getServices(ctx: StoreContext, targetOrgId?: string) {
  const data = ctx.getData();
  const orgId = targetOrgId || data.organization.id;
  let list = (data.services || []).filter((s) => s.organizationId === orgId);
  if (list.length === 0) {
    const seeded = STANDARD_SERVICES.map((s) => ({
      id: crypto.randomUUID(),
      organizationId: orgId,
      category: s.category,
      code: s.code,
      name: s.name,
      description: s.description,
      defaultDurationMin: s.defaultDurationMin,
      basePrice: s.basePrice,
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    if (!data.services) data.services = [];
    data.services.push(...seeded);
    list = seeded;
  }
  return list;
}

export function getTreatments(ctx: StoreContext, branchId?: string, patientId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  let list = (data.treatments || []).filter((t) => t.organizationId === orgId);
  if (branchId) list = list.filter((t) => t.branchId === branchId);
  if (patientId) list = list.filter((t) => t.patientId === patientId);
  return list;
}

export function getPayments(ctx: StoreContext, branchId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  const orgPayments = (data.payments || []).filter((p) => p.organizationId === orgId);
  if (!branchId) return orgPayments;
  return orgPayments.filter((p) => p.branchId === branchId);
}

export function getCashRegisters(ctx: StoreContext, branchId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  const orgRegisters = (data.cashRegisters || []).filter((c) => c.organizationId === orgId);
  if (!branchId) return orgRegisters;
  return orgRegisters.filter((c) => c.branchId === branchId);
}

export function getCashMovements(ctx: StoreContext, cashRegisterId?: string) {
  const data = ctx.getData();
  if (!cashRegisterId) return data.cashMovements || [];
  return (data.cashMovements || []).filter((m) => m.cashRegisterId === cashRegisterId);
}

export function getQuotes(ctx: StoreContext, branchId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  const orgQuotes = (data.quotes || []).filter((q) => q.organizationId === orgId);
  if (!branchId) return orgQuotes;
  return orgQuotes.filter((q) => q.branchId === branchId);
}

export function getQuoteItems(ctx: StoreContext, quoteId?: string) {
  const data = ctx.getData();
  if (!quoteId) return data.quoteItems || [];
  return (data.quoteItems || []).filter((qi) => qi.quoteId === quoteId);
}

export function getBranchServices(ctx: StoreContext, branchId?: string) {
  const data = ctx.getData();
  if (!branchId) return data.branchServices || [];
  return (data.branchServices || []).filter((bs) => bs.branchId === branchId);
}

export function getInsurancePlans(ctx: StoreContext, includeInactive: boolean = false, branchId?: string) {
  const data = ctx.getData();
  const orgId = data.organization.id;
  let list = (data.insurancePlans || []).filter((p) => p.organizationId === orgId);
  if (!includeInactive) {
    list = list.filter((p) => {
      const s = (p.status || '').toUpperCase();
      return s === 'ACTIVO' || s === 'ACTIVE';
    });
  }
  if (branchId) {
    list = list.filter((p) => !p.branchId || p.branchId === branchId);
  }
  return list;
}

export function getAllInsurancePlans(ctx: StoreContext, branchId?: string) {
  return getInsurancePlans(ctx, true, branchId);
}

export function getInsurancePlan(ctx: StoreContext, planId: string) {
  return (ctx.getData().insurancePlans || []).find((p) => p.id === planId) || null;
}

export function getPlanServicePrices(ctx: StoreContext, planId?: string) {
  const data = ctx.getData();
  if (!planId) return data.planServicePrices || [];
  return (data.planServicePrices || []).filter((psp) => psp.planId === planId);
}

export function resolveServicePrice(
  ctx: StoreContext,
  params: {
    serviceId: string;
    patientId?: string | null;
    branchId?: string | null;
    forcedModality?: 'PARTICULAR' | 'PLAN_SEGURO';
    forcedPlanId?: string | null;
  }
) {
  const data = ctx.getData();
  const service = (data.services || []).find((s) => s.id === params.serviceId) || null;
  const branchService = params.branchId
    ? (data.branchServices || []).find((bs) => bs.branchId === params.branchId && bs.serviceId === params.serviceId)
    : null;
  const listPrice = Number(branchService?.customPrice ?? (service?.basePrice || 0));

  const patient = params.patientId ? (data.patients || []).find((p) => p.id === params.patientId) : null;

  const modality: 'PARTICULAR' | 'PLAN_SEGURO' =
    params.forcedModality || (patient?.modality === 'PLAN_SEGURO' ? 'PLAN_SEGURO' : 'PARTICULAR');

  let planId: string | null = null;
  let plan = null;
  let finalPrice = listPrice;
  let hasSpecialPrice = false;
  let coverageNote = '';

  if (modality === 'PLAN_SEGURO') {
    planId = params.forcedPlanId || patient?.insurancePlanId || null;
    if (!planId) {
      const activePlan = (data.insurancePlans || []).find((p) => p.status === 'ACTIVO' || p.status === 'ACTIVE');
      planId = activePlan ? activePlan.id : null;
    }

    if (planId) {
      plan = (data.insurancePlans || []).find((p) => p.id === planId) || null;
      const planPriceEntry = (data.planServicePrices || []).find(
        (psp) => psp.planId === planId && psp.serviceId === params.serviceId
      );

      if (planPriceEntry !== undefined && planPriceEntry !== null) {
        finalPrice = Number(planPriceEntry.price);
        hasSpecialPrice = true;
        coverageNote = planPriceEntry.notes || plan?.coverageTerms || '';
      } else {
        coverageNote = plan?.coverageTerms || 'Sin tarifa especial definida en este plan; aplica tarifa estándar';
      }
    }
  }

  const discountAmount = Math.max(0, listPrice - finalPrice);
  const discountPercentage = listPrice > 0 ? Math.round(((listPrice - finalPrice) / listPrice) * 100) : 0;

  return {
    service,
    modality,
    planId: modality === 'PLAN_SEGURO' ? plan?.id || planId : null,
    planName: modality === 'PLAN_SEGURO' ? plan?.name || null : null,
    planCode: modality === 'PLAN_SEGURO' ? plan?.code || null : null,
    listPrice,
    finalPrice,
    discountAmount,
    discountPercentage,
    hasSpecialPrice,
    coverageNote,
  };
}

export function addTreatment(
  ctx: StoreContext,
  treatment: {
    patientId: string;
    branchId: string;
    title: string;
    totalAmount: number;
    paidAmount?: number;
    toothNumbers?: number[];
    odontologistId?: string;
    quoteId?: string;
    serviceId?: string;
    appliedModality?: 'PARTICULAR' | 'PLAN_SEGURO';
    appliedPlanId?: string;
    appliedPlanName?: string;
    originalListPrice?: number;
    status?: 'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO' | 'SUSPENDIDO';
    startDate?: string;
    notes?: string;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  const id = crypto.randomUUID();
  const paid = treatment.paidAmount || 0;
  const balance = Math.max(0, treatment.totalAmount - paid);

  const patient = (data.patients || []).find((p) => p.id === treatment.patientId);
  const modality: 'PARTICULAR' | 'PLAN_SEGURO' =
    treatment.appliedModality || (patient?.modality === 'PLAN_SEGURO' ? 'PLAN_SEGURO' : 'PARTICULAR');
  const planId = treatment.appliedPlanId || (modality === 'PLAN_SEGURO' ? patient?.insurancePlanId : null) || null;
  const planName =
    treatment.appliedPlanName ||
    (planId ? (data.insurancePlans || []).find((p) => p.id === planId)?.name : null) ||
    null;
  let origListPrice = treatment.originalListPrice;
  if (origListPrice === undefined && treatment.serviceId) {
    const svc = (data.services || []).find((s) => s.id === treatment.serviceId);
    origListPrice = svc?.basePrice || treatment.totalAmount;
  }

  const newTreatment = {
    id,
    organizationId: data.organization.id,
    branchId: treatment.branchId,
    patientId: treatment.patientId,
    quoteId: treatment.quoteId || null,
    serviceId: treatment.serviceId || null,
    appliedModality: modality,
    appliedPlanId: planId,
    appliedPlanName: planName,
    originalListPrice: origListPrice ?? treatment.totalAmount,
    finalAppliedPrice: treatment.totalAmount,
    title: treatment.title,
    totalAmount: treatment.totalAmount,
    paidAmount: paid,
    balanceDue: balance,
    status: treatment.status || 'PLANIFICADO',
    startDate: treatment.startDate || new Date().toISOString().split('T')[0],
    completedDate: null,
    toothNumbers: treatment.toothNumbers || [],
    odontologistId: treatment.odontologistId || data.users.find((u) => u.roleId === 'ODONTOLOGO')?.id,
    notes: treatment.notes || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!data.treatments) {
    data.treatments = [];
  }
  data.treatments.unshift(newTreatment);

  if (modality === 'PLAN_SEGURO' && planId) {
    if (!data.insuranceClaims) data.insuranceClaims = [];
    const planObj = (data.insurancePlans || []).find((p) => p.id === planId);
    const covered = Math.max(0, (origListPrice ?? treatment.totalAmount) - treatment.totalAmount);
    const claimCode = planObj?.code ? planObj.code.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() : 'SEG';
    const seq = (data.insuranceClaims.length + 1).toString().padStart(4, '0');
    const claimNumber = `LIQ-${claimCode}-2026-${seq}`;

    const newClaim = {
      id: crypto.randomUUID(),
      organizationId: data.organization.id,
      branchId: treatment.branchId,
      planId,
      claimNumber,
      patientId: treatment.patientId,
      treatmentId: id,
      serviceId: treatment.serviceId || null,
      patientMemberNumber: patient?.insuranceMemberNumber || null,
      serviceName: treatment.title,
      toothNumber: treatment.toothNumbers?.[0] || null,
      originalListPrice: origListPrice ?? treatment.totalAmount,
      copayAmount: treatment.totalAmount,
      coveredAmount: covered > 0 ? covered : origListPrice ?? treatment.totalAmount,
      status: 'PENDIENTE_ENVIO',
      submissionDate: null,
      settledDate: null,
      settlementReference: null,
      notes: `Generado automáticamente por plan de tratamiento odontológico "${treatment.title}"`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    data.insuranceClaims.unshift(newClaim);
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: treatment.branchId,
    userId: treatment.actorUserId || data.users[0]?.id,
    action: 'CREATE',
    entity: 'TREATMENT',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Treatments Manager',
    oldValues: null,
    newValues: newTreatment,
    description: `Creación de plan de tratamiento "${treatment.title}" por valor de ₲ ${treatment.totalAmount.toLocaleString('es-PY')}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newTreatment;
}

export function updateTreatmentStatus(
  ctx: StoreContext,
  treatmentId: string,
  status: 'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO' | 'SUSPENDIDO',
  completedDate?: string,
  actorUserId?: string
) {
  const data = ctx.getData();
  const treat = (data.treatments || []).find((t) => t.id === treatmentId);
  if (!treat) return null;

  const oldStatus = treat.status;
  treat.status = status;
  if (status === 'COMPLETADO') {
    treat.completedDate = completedDate || new Date().toISOString().split('T')[0];
  }
  treat.updatedAt = new Date();

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: treat.branchId,
    userId: actorUserId || data.users[0]?.id,
    action: 'STATUS_CHANGE',
    entity: 'TREATMENT',
    entityId: treatmentId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Treatments Manager',
    oldValues: { status: oldStatus },
    newValues: { status, completedDate: treat.completedDate },
    description: `Actualización de estado de tratamiento "${treat.title}" a "${status}"`,
    createdAt: new Date(),
  });

  if (status === 'COMPLETADO') {
    const linkedQuote = treat.quoteId ? (data.quotes || []).find((q) => q.id === treat.quoteId) : null;
    evaluateCommissionsForEvent(data, {
      eventType: 'TREATMENT_COMPLETED',
      organizationId: data.organization.id,
      branchId: treat.branchId,
      patientId: treat.patientId,
      quoteId: treat.quoteId || null,
      treatmentId: treat.id,
      odontologistUserId: linkedQuote?.odontologistId || (treat as any).odontologistId || actorUserId || null,
      amount: treat.totalAmount,
      eventDate: treat.completedDate || getTodayAsuncionISO(),
      actorUserId: actorUserId || data.users[0]?.id || null,
    });
  }

  ctx.notify();
  return treat;
}

export function recordTreatmentPayment(
  ctx: StoreContext,
  treatmentId: string,
  amount: number,
  paymentMethod: string,
  receiptNumber: string,
  actorUserId?: string,
  paymentDate?: string
) {
  const data = ctx.getData();
  const validatedAmount = validatePygPrice(amount, 'El monto a abonar');

  const treat = (data.treatments || []).find((t) => t.id === treatmentId);
  if (!treat) throw new Error('El tratamiento especificado no existe.');

  if (treat.balanceDue > 0 && validatedAmount > treat.balanceDue) {
    throw new Error(
      `El monto (${formatPYG(validatedAmount)}) excede el saldo pendiente (${formatPYG(treat.balanceDue)}).`
    );
  }

  const todayAsuncion = getTodayAsuncionISO();
  const cleanPaymentDate =
    paymentDate && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate.trim()) ? paymentDate.trim() : '';
  const isHistoricalPayment = Boolean(cleanPaymentDate && cleanPaymentDate < todayAsuncion);
  const paymentCreatedAt = isHistoricalPayment ? new Date(`${cleanPaymentDate}T16:00:00.000Z`) : new Date();

  treat.paidAmount = (treat.paidAmount || 0) + validatedAmount;
  treat.balanceDue = Math.max(0, treat.totalAmount - treat.paidAmount);
  treat.updatedAt = new Date();

  const paymentId = crypto.randomUUID();
  const invoiceNumber = ctx.getNextInvoiceNumber();
  const paymentRecord = {
    id: paymentId,
    organizationId: data.organization.id,
    branchId: treat.branchId,
    patientId: treat.patientId,
    treatmentId: treat.id,
    appointmentId: null,
    cashMovementId: null as string | null,
    receiptNumber: receiptNumber || ctx.getNextReceiptNumber(),
    invoiceNumber,
    amount: validatedAmount,
    paymentMethod,
    status: 'COMPLETADO',
    notes: isHistoricalPayment
      ? `Pago histórico (${cleanPaymentDate}) abonado a cuenta del tratamiento ${treat.title}`
      : `Pago abonado a cuenta del tratamiento ${treat.title}`,
    receivedBy: actorUserId || data.users[0]?.id,
    createdAt: paymentCreatedAt,
  };

  if (!data.payments) {
    data.payments = [];
  }
  data.payments.unshift(paymentRecord);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: treat.branchId,
    userId: actorUserId || data.users[0]?.id,
    action: 'PAYMENT',
    entity: 'TREATMENT',
    entityId: treatmentId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Financial Engine',
    oldValues: null,
    newValues: {
      amount: validatedAmount,
      balanceDue: treat.balanceDue,
      receiptNumber: paymentRecord.receiptNumber,
      ...(isHistoricalPayment ? { paymentDate: cleanPaymentDate } : {}),
    },
    description: `Cobro de ${formatPYG(validatedAmount)} registrado para tratamiento "${treat.title}" (Recibo: ${paymentRecord.receiptNumber})`,
    createdAt: new Date(),
  });

  if (!isHistoricalPayment) {
    const openRegister = (data.cashRegisters || []).find(
      (cr) => cr.branchId === treat.branchId && cr.status === 'ABIERTA'
    );
    if (openRegister) {
      const movementId = crypto.randomUUID();
      data.cashMovements.unshift({
        id: movementId,
        cashRegisterId: openRegister.id,
        movementType: 'INGRESO',
        amount: validatedAmount,
        paymentMethod,
        concept: `Cobro tratamiento ${treat.title} (Recibo ${paymentRecord.receiptNumber})`,
        referenceNumber: paymentRecord.receiptNumber,
        performedBy: actorUserId || data.users[0]?.id,
        createdAt: new Date(),
      });
      paymentRecord.cashMovementId = movementId;
    }
  }

  const linkedQuote = treat.quoteId ? (data.quotes || []).find((q) => q.id === treat.quoteId) : null;
  evaluateCommissionsForEvent(data, {
    eventType: 'PAYMENT_COLLECTED',
    organizationId: data.organization.id,
    branchId: treat.branchId,
    patientId: treat.patientId,
    quoteId: treat.quoteId || null,
    treatmentId: treat.id,
    paymentId: paymentRecord.id,
    odontologistUserId: linkedQuote?.odontologistId || (treat as any).odontologistId || null,
    amount: validatedAmount,
    eventDate: cleanPaymentDate || todayAsuncion,
    actorUserId: actorUserId || data.users[0]?.id || null,
  });

  ctx.notify();
  return treat;
}

export function annulPayment(
  ctx: StoreContext,
  params: {
    paymentId: string;
    reason: string;
    actorUserId: string;
  }
) {
  const data = ctx.getData();
  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error('Debe proporcionar un motivo válido de anulación (mínimo 5 caracteres).');
  }

  const payment = (data.payments || []).find((p) => p.id === params.paymentId);
  if (!payment) {
    throw new Error('El recibo / pago no fue encontrado.');
  }

  if (payment.status === 'ANULADO') {
    throw new Error('Este recibo ya se encuentra anulado.');
  }

  const previousStatus = payment.status;
  payment.status = 'ANULADO';
  (payment as any).annulledAt = new Date();
  (payment as any).annulledReason = params.reason;
  (payment as any).annulledBy = params.actorUserId;

  let restoredTreatment = null;
  if (payment.treatmentId) {
    const treat = (data.treatments || []).find((t) => t.id === payment.treatmentId);
    if (treat) {
      treat.paidAmount = Math.max(0, (treat.paidAmount || 0) - payment.amount);
      treat.balanceDue = Math.max(0, treat.totalAmount - treat.paidAmount);
      treat.updatedAt = new Date();
      restoredTreatment = treat;
    }
  }

  let counterMovement = null;
  const openRegister = (data.cashRegisters || []).find(
    (cr) => cr.branchId === payment.branchId && cr.status === 'ABIERTA'
  );
  if (openRegister) {
    const origMovement = payment.cashMovementId
      ? (data.cashMovements || []).find((m) => m.id === payment.cashMovementId)
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
      const counterMovementId = crypto.randomUUID();
      counterMovement = {
        id: counterMovementId,
        cashRegisterId: openRegister.id,
        movementType: 'EGRESO' as const,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        concept: `[ANULACIÓN] Recibo ${payment.receiptNumber}: ${params.reason}`,
        referenceNumber: `ANUL-${payment.receiptNumber}`,
        performedBy: params.actorUserId,
        createdAt: new Date(),
      };
      data.cashMovements.unshift(counterMovement);
    }
  }

  reverseCommissionsForAnnulledPayment(data, params.paymentId, params.reason, params.actorUserId);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: payment.branchId,
    userId: params.actorUserId,
    action: 'ANNUL_PAYMENT',
    entity: 'PAYMENT',
    entityId: payment.id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Audit & Security Manager',
    oldValues: { status: previousStatus, amount: payment.amount, receiptNumber: payment.receiptNumber },
    newValues: {
      status: 'ANULADO',
      reason: params.reason,
      treatmentBalanceRestored: restoredTreatment?.balanceDue,
    },
    description: `Anulación de Recibo ${payment.receiptNumber} por ₲ ${payment.amount.toLocaleString('es-PY')}. Motivo: "${params.reason}"`,
    createdAt: new Date(),
  });

  ctx.notify();
  return {
    payment,
    restoredTreatment,
    counterMovement,
  };
}

export function addService(
  ctx: StoreContext,
  service: {
    category: string;
    code: string;
    name: string;
    description?: string;
    defaultDurationMin: number;
    basePrice: number;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  const cleanName = (service.name || '').trim();
  if (!cleanName) {
    throw new Error('El nombre del procedimiento es requerido.');
  }
  const validatedPrice = validatePygPrice(service.basePrice, 'El precio base');

  const id = crypto.randomUUID();
  const record = {
    id,
    organizationId: data.organization.id,
    category: service.category,
    code: (service.code || '').trim().toUpperCase(),
    name: cleanName,
    description: service.description || '',
    defaultDurationMin: Math.max(5, Math.round(Number(service.defaultDurationMin) || 30)),
    basePrice: validatedPrice,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  data.services = [...data.services, record];

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: service.actorUserId || data.users[0]?.id,
    action: 'CREATE',
    entity: 'SERVICE',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Catalogs Admin',
    oldValues: null,
    newValues: record,
    description: `Nuevo servicio odontológico incorporado: "${cleanName}" (${record.code}) - ${formatPYG(validatedPrice)}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return record;
}

export function updateService(
  ctx: StoreContext,
  serviceId: string,
  updates: Partial<{
    category: string;
    code: string;
    name: string;
    description: string;
    defaultDurationMin: number;
    basePrice: number;
    status: string;
  }>,
  actorUserId?: string,
  options?: {
    syncBranchPrices?: 'matching_only' | 'all' | 'none';
  }
) {
  const data = ctx.getData();
  const idx = data.services.findIndex((serv) => serv.id === serviceId);
  if (idx === -1) return null;

  const old = data.services[idx];
  const nextUpdates: Record<string, any> = { ...updates };

  if (nextUpdates.name !== undefined) {
    const cleanName = String(nextUpdates.name).trim();
    if (!cleanName) {
      throw new Error('El nombre del procedimiento es requerido.');
    }
    nextUpdates.name = cleanName;
  }

  if (nextUpdates.code !== undefined) {
    nextUpdates.code = String(nextUpdates.code).trim().toUpperCase();
  }

  if (nextUpdates.defaultDurationMin !== undefined) {
    nextUpdates.defaultDurationMin = Math.max(5, Math.round(Number(nextUpdates.defaultDurationMin) || 30));
  }

  if (nextUpdates.basePrice !== undefined) {
    nextUpdates.basePrice = validatePygPrice(nextUpdates.basePrice, 'El precio base');
  }

  const oldBasePrice = Number(old.basePrice);
  const updatedService = {
    ...old,
    ...nextUpdates,
    updatedAt: new Date(),
  };

  // Reemplazo inmutable para que las vistas con useMemo/subscribe refresquen de inmediato
  data.services = data.services.map((serv, i) => (i === idx ? updatedService : serv));

  // Si cambió el precio base, sincronizar branchServices para que nuevos tratamientos/presupuestos
  // reflejen el nuevo arancel sin alterar ningún tratamiento, presupuesto ni cobro histórico existente.
  const priceChanged =
    nextUpdates.basePrice !== undefined && Number(updatedService.basePrice) !== oldBasePrice;
  const syncMode = options?.syncBranchPrices ?? 'matching_only';
  let updatedBranchCount = 0;

  if (priceChanged && syncMode !== 'none' && Array.isArray(data.branchServices) && data.branchServices.length > 0) {
    data.branchServices = data.branchServices.map((bs) => {
      if (bs.serviceId !== serviceId) return bs;
      if (syncMode === 'all' || Number(bs.customPrice) === oldBasePrice) {
        updatedBranchCount += 1;
        return {
          ...bs,
          customPrice: updatedService.basePrice,
        };
      }
      return bs;
    });
  }

  const oldAuditValues: Record<string, any> = {};
  const newAuditValues: Record<string, any> = {};
  for (const key of Object.keys(nextUpdates)) {
    oldAuditValues[key] = (old as any)[key];
    newAuditValues[key] = (updatedService as any)[key];
  }
  if (priceChanged) {
    newAuditValues.updatedBranchPricesCount = updatedBranchCount;
    newAuditValues.syncBranchPricesMode = syncMode;
  }

  const auditDescription = priceChanged
    ? `Cambio de precio en "${updatedService.name}": ${formatPYG(oldBasePrice)} → ${formatPYG(updatedService.basePrice)} (aplica solo a nuevos registros; sucursales sincronizadas: ${updatedBranchCount})`
    : `Modificación de parámetros del servicio odontológico "${updatedService.name}"`;

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: actorUserId || data.users[0]?.id,
    action: priceChanged ? 'UPDATE_PRICE' : 'UPDATE',
    entity: 'SERVICE',
    entityId: serviceId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Catalogs Admin',
    oldValues: oldAuditValues,
    newValues: newAuditValues,
    description: auditDescription,
    createdAt: new Date(),
  });

  ctx.notify();
  return updatedService;
}

export function setBranchServicePrice(
  ctx: StoreContext,
  branchId: string,
  serviceId: string,
  customPrice: number,
  isAvailable: boolean = true,
  actorUserId?: string
) {
  const data = ctx.getData();
  const validatedPrice = validatePygPrice(customPrice, 'El precio por sucursal');

  if (!data.branchServices) {
    data.branchServices = [];
  }

  const existingIdx = data.branchServices.findIndex(
    (bs) => bs.branchId === branchId && bs.serviceId === serviceId
  );
  const existing = existingIdx >= 0 ? data.branchServices[existingIdx] : null;
  const previousPrice = existing ? Number(existing.customPrice) : null;

  const branch = data.branches.find((b) => b.id === branchId);
  const service = data.services.find((s) => s.id === serviceId);

  if (existingIdx >= 0) {
    data.branchServices = data.branchServices.map((bs, i) =>
      i === existingIdx
        ? {
            ...bs,
            customPrice: validatedPrice,
            isAvailable,
          }
        : bs
    );
  } else {
    data.branchServices = [
      ...data.branchServices,
      {
        branchId,
        serviceId,
        customPrice: validatedPrice,
        isAvailable,
      },
    ];
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId,
    userId: actorUserId || data.users[0]?.id,
    action: 'UPDATE_PRICING',
    entity: 'BRANCH_SERVICE',
    entityId: `${branchId}-${serviceId}`,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Pricing Engine',
    oldValues: {
      customPrice: previousPrice ?? (service ? Number(service.basePrice) : null),
      isAvailable: existing ? existing.isAvailable : true,
    },
    newValues: { customPrice: validatedPrice, isAvailable },
    description: `Ajuste de precio para "${service?.name}" en sucursal ${branch?.name}: ${previousPrice !== null ? `${formatPYG(previousPrice)} → ` : ''}${formatPYG(validatedPrice)} (solo nuevos registros)`,
    createdAt: new Date(),
  });

  ctx.notify();
  return { branchId, serviceId, customPrice: validatedPrice, isAvailable };
}

export function createInsurancePlan(
  ctx: StoreContext,
  plan: {
    code: string;
    name: string;
    description?: string;
    coverageTerms?: string;
    status?: 'ACTIVO' | 'INACTIVO';
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  if (!data.insurancePlans) {
    data.insurancePlans = [];
  }

  const id = crypto.randomUUID();
  const newPlan = {
    id,
    organizationId: data.organization.id,
    code: plan.code.toUpperCase().trim(),
    name: plan.name.trim(),
    description: plan.description || '',
    coverageTerms: plan.coverageTerms || '',
    status: plan.status || 'ACTIVO',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.insurancePlans.unshift(newPlan);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: plan.actorUserId || data.users[0]?.id,
    action: 'CREATE',
    entity: 'INSURANCE_PLAN',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Insurance Engine',
    oldValues: null,
    newValues: newPlan,
    description: `Creación de nuevo plan/seguro odontológico "${newPlan.name}" (${newPlan.code})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newPlan;
}

export function updateInsurancePlan(
  ctx: StoreContext,
  planId: string,
  updates: Partial<{
    code: string;
    name: string;
    description: string;
    coverageTerms: string;
    status: 'ACTIVO' | 'INACTIVO';
  }>,
  actorUserId?: string
) {
  const data = ctx.getData();
  const plan = (data.insurancePlans || []).find((p) => p.id === planId);
  if (!plan) return null;

  const oldValues = { ...plan };
  Object.assign(plan, updates, { updatedAt: new Date() });

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: actorUserId || data.users[0]?.id,
    action: 'UPDATE',
    entity: 'INSURANCE_PLAN',
    entityId: planId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Insurance Engine',
    oldValues,
    newValues: updates,
    description: `Actualización de parámetros del plan/seguro "${plan.name}"`,
    createdAt: new Date(),
  });

  ctx.notify();
  return plan;
}

export function toggleInsurancePlanStatus(ctx: StoreContext, planId: string, actorUserId?: string) {
  const data = ctx.getData();
  const plan = (data.insurancePlans || []).find((p) => p.id === planId);
  if (!plan) return null;

  const newStatus = plan.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
  plan.status = newStatus;
  plan.updatedAt = new Date();

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: actorUserId || data.users[0]?.id,
    action: 'STATUS_CHANGE',
    entity: 'INSURANCE_PLAN',
    entityId: planId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Insurance Engine',
    oldValues: null,
    newValues: { status: newStatus },
    description: `Cambio de estado del plan/seguro "${plan.name}" a ${newStatus}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return plan;
}

export function setPlanServicePrice(
  ctx: StoreContext,
  planId: string,
  serviceId: string,
  price: number,
  notes?: string,
  actorUserId?: string
) {
  const data = ctx.getData();
  if (!data.planServicePrices) {
    data.planServicePrices = [];
  }

  const plan = (data.insurancePlans || []).find((p) => p.id === planId);
  const service = (data.services || []).find((s) => s.id === serviceId);
  const existing = data.planServicePrices.find((psp) => psp.planId === planId && psp.serviceId === serviceId);

  if (existing) {
    existing.price = price;
    if (notes !== undefined) existing.notes = notes;
    existing.updatedAt = new Date();
  } else {
    data.planServicePrices.push({
      id: crypto.randomUUID(),
      planId,
      serviceId,
      price,
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: actorUserId || data.users[0]?.id,
    action: 'UPDATE_PRICING',
    entity: 'PLAN_SERVICE_PRICE',
    entityId: `${planId}-${serviceId}`,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Pricing Engine',
    oldValues: null,
    newValues: { price, notes },
    description: `Fijación de tarifa para "${service?.name || serviceId}" en plan "${plan?.name || planId}": ₲ ${Number(price || 0).toLocaleString('es-PY')}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return { planId, serviceId, price, notes };
}

export function getEffectiveServicePrice(
  ctx: StoreContext,
  serviceId: string,
  patientId?: string,
  branchId?: string
): {
  price: number;
  originalBasePrice: number;
  modality: 'PARTICULAR' | 'PLAN_SEGURO';
  planId: string | null;
  planName: string | null;
  isCoveredByPlan: boolean;
  discountOrCopayAmount: number;
  notes: string;
} {
  const data = ctx.getData();
  const service = (data.services || []).find((s) => s.id === serviceId);
  if (!service) {
    return {
      price: 0,
      originalBasePrice: 0,
      modality: 'PARTICULAR',
      planId: null,
      planName: null,
      isCoveredByPlan: false,
      discountOrCopayAmount: 0,
      notes: 'Servicio no encontrado',
    };
  }

  let listPrice = service.basePrice;
  if (branchId) {
    const branchSvc = (data.branchServices || []).find(
      (bs) => bs.branchId === branchId && bs.serviceId === serviceId && bs.isAvailable
    );
    if (branchSvc) {
      listPrice = branchSvc.customPrice;
    }
  }

  if (!patientId) {
    return {
      price: listPrice,
      originalBasePrice: listPrice,
      modality: 'PARTICULAR',
      planId: null,
      planName: null,
      isCoveredByPlan: false,
      discountOrCopayAmount: 0,
      notes: 'Precio Particular de Lista',
    };
  }

  const patient = (data.patients || []).find((p) => p.id === patientId);
  if (!patient || patient.modality !== 'PLAN_SEGURO' || !patient.insurancePlanId) {
    return {
      price: listPrice,
      originalBasePrice: listPrice,
      modality: 'PARTICULAR',
      planId: null,
      planName: null,
      isCoveredByPlan: false,
      discountOrCopayAmount: 0,
      notes: 'Modalidad Particular (Sin Plan Activo)',
    };
  }

  const plan = (data.insurancePlans || []).find((p) => p.id === patient.insurancePlanId);
  if (!plan || plan.status !== 'ACTIVO') {
    return {
      price: listPrice,
      originalBasePrice: listPrice,
      modality: 'PARTICULAR',
      planId: plan?.id || null,
      planName: plan?.name || null,
      isCoveredByPlan: false,
      discountOrCopayAmount: 0,
      notes: plan ? `Plan ${plan.name} Inactivo (Aplica Particular)` : 'Plan no encontrado',
    };
  }

  const planPrice = (data.planServicePrices || []).find(
    (psp) => psp.planId === plan.id && psp.serviceId === serviceId
  );

  if (planPrice) {
    const discount = Math.max(0, listPrice - planPrice.price);
    return {
      price: planPrice.price,
      originalBasePrice: listPrice,
      modality: 'PLAN_SEGURO',
      planId: plan.id,
      planName: plan.name,
      isCoveredByPlan: true,
      discountOrCopayAmount: discount,
      notes: planPrice.notes || (planPrice.price === 0 ? '100% Cubierto por Seguro' : `Copago Plan ${plan.name}`),
    };
  }

  return {
    price: listPrice,
    originalBasePrice: listPrice,
    modality: 'PLAN_SEGURO',
    planId: plan.id,
    planName: plan.name,
    isCoveredByPlan: false,
    discountOrCopayAmount: 0,
    notes: `No tarifado en ${plan.name} (Aplica precio lista)`,
  };
}

export function getInsuranceClaims(
  ctx: StoreContext,
  filters?: {
    planId?: string;
    status?: string;
    branchId?: string;
    patientId?: string;
  }
) {
  const data = ctx.getData();
  if (!data.insuranceClaims) data.insuranceClaims = [];
  return data.insuranceClaims.filter((c: any) => {
    if (filters?.planId && filters.planId !== 'TODOS' && c.planId !== filters.planId) return false;
    if (filters?.status && filters.status !== 'TODOS' && c.status !== filters.status) return false;
    if (filters?.branchId && filters.branchId !== 'TODAS' && c.branchId !== filters.branchId) return false;
    if (filters?.patientId && c.patientId !== filters.patientId) return false;
    return true;
  });
}

export function getNextClaimNumber(ctx: StoreContext, planCode = 'SEG') {
  const data = ctx.getData();
  if (!data.insuranceClaims) data.insuranceClaims = [];
  const cleanCode = (planCode || 'SEG').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
  const count = data.insuranceClaims.length + 1;
  return `LIQ-${cleanCode}-2026-${count.toString().padStart(4, '0')}`;
}

export function createInsuranceClaim(
  ctx: StoreContext,
  params: {
    branchId: string;
    planId: string;
    patientId: string;
    treatmentId?: string;
    serviceId?: string;
    patientMemberNumber?: string;
    serviceName: string;
    toothNumber?: number | null;
    originalListPrice: number;
    copayAmount: number;
    coveredAmount: number;
    notes?: string;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  if (!data.insuranceClaims) data.insuranceClaims = [];
  const plan = (data.insurancePlans || []).find((p) => p.id === params.planId);
  const claimNumber = getNextClaimNumber(ctx, plan?.code);
  const id = crypto.randomUUID();

  const newClaim = {
    id,
    organizationId: data.organization.id,
    branchId: params.branchId,
    planId: params.planId,
    claimNumber,
    patientId: params.patientId,
    treatmentId: params.treatmentId || null,
    serviceId: params.serviceId || null,
    patientMemberNumber: params.patientMemberNumber || null,
    serviceName: params.serviceName,
    toothNumber: params.toothNumber || null,
    originalListPrice: params.originalListPrice,
    copayAmount: params.copayAmount,
    coveredAmount: params.coveredAmount,
    status: 'PENDIENTE_ENVIO',
    submissionDate: null,
    settledDate: null,
    settlementReference: null,
    notes: params.notes || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.insuranceClaims.unshift(newClaim);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: params.branchId,
    userId: params.actorUserId || data.users[0]?.id,
    action: 'CREATE',
    entity: 'INSURANCE_CLAIM',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Insurance Claims Engine',
    oldValues: null,
    newValues: newClaim,
    description: `Generación de reclamo ${claimNumber} para plan ${plan?.name || 'Seguro'} por valor de ₲ ${params.coveredAmount.toLocaleString('es-PY')}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newClaim;
}

export function updateInsuranceClaimStatus(
  ctx: StoreContext,
  claimId: string,
  status: 'PENDIENTE_ENVIO' | 'EN_AUDITORIA' | 'APROBADO' | 'LIQUIDADO_COBRADO' | 'RECHAZADO',
  options?: {
    settlementReference?: string;
    notes?: string;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  if (!data.insuranceClaims) data.insuranceClaims = [];
  const claim = data.insuranceClaims.find((c: any) => c.id === claimId);
  if (!claim) return null;

  const oldStatus = claim.status;
  claim.status = status;
  claim.updatedAt = new Date();

  if (status === 'EN_AUDITORIA' && !claim.submissionDate) {
    claim.submissionDate = new Date();
  }
  if (status === 'LIQUIDADO_COBRADO') {
    claim.settledDate = new Date();
    if (options?.settlementReference) {
      claim.settlementReference = options.settlementReference;
    }
  }
  if (options?.notes) {
    claim.notes = options.notes;
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: claim.branchId,
    userId: options?.actorUserId || data.users[0]?.id,
    action: 'UPDATE',
    entity: 'INSURANCE_CLAIM',
    entityId: claimId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Claims Engine',
    oldValues: { status: oldStatus },
    newValues: { status, settlementReference: claim.settlementReference },
    description: `Actualización de reclamo ${claim.claimNumber}: ${oldStatus} -> ${status}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return claim;
}

export function batchSettleInsuranceClaims(
  ctx: StoreContext,
  params: {
    claimIds: string[];
    paymentMethod: string;
    settlementReference: string;
    targetCashRegisterId?: string;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  if (!data.insuranceClaims) data.insuranceClaims = [];
  const targetClaims = data.insuranceClaims.filter((c: any) => params.claimIds.includes(c.id));
  if (targetClaims.length === 0) {
    throw new Error('No se encontraron reclamos para liquidar.');
  }

  const now = new Date();
  let totalCoveredAmount = 0;

  targetClaims.forEach((claim: any) => {
    claim.status = 'LIQUIDADO_COBRADO';
    claim.settledDate = now;
    claim.settlementReference = params.settlementReference;
    claim.updatedAt = now;
    totalCoveredAmount += claim.coveredAmount || 0;
  });

  let cashMovementId: string | null = null;
  const cashRegId = params.targetCashRegisterId || (data.cashRegisters || []).find((c) => c.status === 'ABIERTA')?.id;
  if (cashRegId && totalCoveredAmount > 0) {
    const firstClaim = targetClaims[0];
    const plan = (data.insurancePlans || []).find((p) => p.id === firstClaim?.planId);
    const planName = plan?.name || 'Aseguradora';
    const receiptNumber = ctx.getNextReceiptNumber();

    const mov = ctx.addCashMovement({
      cashRegisterId: cashRegId,
      movementType: 'INGRESO',
      amount: totalCoveredAmount,
      paymentMethod: params.paymentMethod || 'TRANSFERENCIA_SIPAP',
      concept: `Liquidación Aseguradora (${planName}) - ${targetClaims.length} prestaciones`,
      referenceNumber: params.settlementReference,
      receiptNumber,
      actorUserId: params.actorUserId || data.users[0]?.id,
    });
    cashMovementId = mov.id;
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: targetClaims[0]?.branchId || null,
    userId: params.actorUserId || data.users[0]?.id,
    action: 'BATCH_SETTLE_CLAIMS',
    entity: 'INSURANCE_CLAIM',
    entityId: params.settlementReference,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Claims Settlement',
    oldValues: { settledCount: 0 },
    newValues: {
      settledCount: targetClaims.length,
      totalAmount: totalCoveredAmount,
      settlementReference: params.settlementReference,
    },
    description: `Liquidación masiva de ${targetClaims.length} prestaciones de seguro por ₲ ${totalCoveredAmount.toLocaleString('es-PY')} (Ref: ${params.settlementReference})`,
    createdAt: now,
  });

  ctx.notify();
  return {
    settledClaimsCount: targetClaims.length,
    totalAmount: totalCoveredAmount,
    cashMovementId,
    settlementReference: params.settlementReference,
  };
}

export function getInsuranceClaimsMetrics(ctx: StoreContext) {
  const data = ctx.getData();
  if (!data.insuranceClaims) data.insuranceClaims = [];
  const claims = data.insuranceClaims;
  const totalClaimed = claims.reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);
  const totalSettled = claims
    .filter((c: any) => c.status === 'LIQUIDADO_COBRADO')
    .reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);
  const totalPending = claims
    .filter((c: any) => c.status !== 'LIQUIDADO_COBRADO' && c.status !== 'RECHAZADO')
    .reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);
  const countTotal = claims.length;
  const countPending = claims.filter((c: any) => c.status === 'PENDIENTE_ENVIO').length;
  const countAuditing = claims.filter((c: any) => c.status === 'EN_AUDITORIA').length;
  const countApproved = claims.filter((c: any) => c.status === 'APROBADO').length;
  const countSettled = claims.filter((c: any) => c.status === 'LIQUIDADO_COBRADO').length;
  const countRejected = claims.filter((c: any) => c.status === 'RECHAZADO').length;

  return {
    totalClaimed,
    totalSettled,
    totalPending,
    countTotal,
    countPending,
    countAuditing,
    countApproved,
    countSettled,
    countRejected,
  };
}

export function createQuote(
  ctx: StoreContext,
  params: {
    branchId: string;
    patientId: string;
    odontologistId?: string;
    planId?: string | null;
    validUntil?: string;
    notes?: string;
    discountAmount?: number;
    items: Array<{
      serviceId?: string;
      toothNumber?: number;
      description: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      appliedModality?: 'PARTICULAR' | 'PLAN_SEGURO';
      appliedPlanId?: string | null;
      appliedPlanName?: string | null;
      originalListPrice?: number;
    }>;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  const id = crypto.randomUUID();
  const quoteNumber = ctx.getNextQuoteNumber();
  const totalAmount = params.items.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number(item.subtotal || item.unitPrice * item.quantity) || 0)),
    0
  );
  const discountAmount = Math.max(0, Math.round(Number(params.discountAmount || 0)));
  if (discountAmount > totalAmount) {
    throw new Error('El descuento adicional no puede superar el subtotal bruto del presupuesto.');
  }
  const finalAmount = Math.max(0, totalAmount - discountAmount);

  const validUntilDate = params.validUntil || addDaysToIsoDate(getTodayAsuncionISO(), 30);

  const patient = (data.patients || []).find((p) => p.id === params.patientId);
  // Respetar explícitamente planId === null (Particular), incluso si el paciente tiene seguro en ficha
  const resolvedPlanId =
    params.planId !== undefined
      ? params.planId || null
      : patient?.insurancePlanId || null;
  const selectedPlan = resolvedPlanId
    ? (data.insurancePlans || []).find((p) => p.id === resolvedPlanId) || null
    : null;

  const newQuote = {
    id,
    organizationId: data.organization.id,
    branchId: params.branchId,
    patientId: params.patientId,
    planId: selectedPlan?.id || null,
    planName: selectedPlan?.name || null,
    odontologistId: params.odontologistId || data.users.find((u) => u.roleId === 'ODONTOLOGO')?.id || null,
    quoteNumber,
    totalAmount,
    discountAmount,
    finalAmount,
    status: 'PENDIENTE',
    validUntil: validUntilDate,
    notes: params.notes || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.quotes = [newQuote, ...(data.quotes || [])];

  if (!data.quoteItems) {
    data.quoteItems = [];
  }

  params.items.forEach((item) => {
    const appliedModality =
      item.appliedModality ||
      (selectedPlan ? 'PLAN_SEGURO' : patient?.modality === 'PLAN_SEGURO' ? 'PLAN_SEGURO' : 'PARTICULAR');
    const appliedPlanId =
      item.appliedPlanId !== undefined
        ? item.appliedPlanId
        : appliedModality === 'PLAN_SEGURO'
          ? selectedPlan?.id || null
          : null;
    const appliedPlanName =
      item.appliedPlanName !== undefined
        ? item.appliedPlanName
        : appliedPlanId
          ? (data.insurancePlans || []).find((p) => p.id === appliedPlanId)?.name || null
          : null;
    const origListPrice = item.originalListPrice ?? item.unitPrice;

    data.quoteItems.push({
      id: crypto.randomUUID(),
      quoteId: id,
      serviceId: item.serviceId || null,
      toothNumber: item.toothNumber || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal || item.quantity * item.unitPrice,
      appliedModality,
      appliedPlanId,
      appliedPlanName,
      originalListPrice: origListPrice,
    });
  });

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: params.branchId,
    userId: params.actorUserId || data.users[0]?.id,
    action: 'CREATE',
    entity: 'QUOTE',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Quotes Engine',
    oldValues: null,
    newValues: { quoteNumber, finalAmount, itemsCount: params.items.length, planId: selectedPlan?.id || null },
    description: `Presupuesto ${quoteNumber} emitido para ${patient?.firstName} ${patient?.lastName}${selectedPlan ? ` (Plan: ${selectedPlan.name})` : ''} por ₲ ${finalAmount.toLocaleString('es-PY')}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newQuote;
}

export function updateQuote(
  ctx: StoreContext,
  quoteId: string,
  params: {
    branchId?: string;
    patientId?: string;
    odontologistId?: string;
    planId?: string | null;
    validUntil?: string;
    notes?: string;
    discountAmount?: number;
    items?: Array<{
      serviceId?: string;
      toothNumber?: number;
      description: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      appliedModality?: 'PARTICULAR' | 'PLAN_SEGURO';
      appliedPlanId?: string | null;
      appliedPlanName?: string | null;
      originalListPrice?: number;
    }>;
    actorUserId?: string;
  }
) {
  const data = ctx.getData();
  const qIndex = (data.quotes || []).findIndex((q) => q.id === quoteId);
  if (qIndex === -1) return null;
  const q = { ...data.quotes[qIndex] };

  if (q.status === 'APROBADO' || q.status === 'RECHAZADO') {
    throw new Error(`No se puede modificar un presupuesto que ya fue ${q.status}.`);
  }

  const selectedPlan =
    params.planId !== undefined
      ? params.planId
        ? (data.insurancePlans || []).find((p) => p.id === params.planId)
        : null
      : q.planId
        ? (data.insurancePlans || []).find((p) => p.id === q.planId)
        : null;

  if (params.items && Array.isArray(params.items)) {
    const totalAmount = params.items.reduce(
      (sum, item) => sum + Math.max(0, Math.round(Number(item.subtotal || item.unitPrice * item.quantity) || 0)),
      0
    );
    const discountAmount = Math.max(
      0,
      Math.round(Number(params.discountAmount !== undefined ? params.discountAmount : q.discountAmount || 0))
    );
    if (discountAmount > totalAmount) {
      throw new Error('El descuento adicional no puede superar el subtotal bruto del presupuesto.');
    }
    const finalAmount = Math.max(0, totalAmount - discountAmount);

    q.totalAmount = totalAmount;
    q.discountAmount = discountAmount;
    q.finalAmount = finalAmount;

    data.quoteItems = (data.quoteItems || []).filter((qi) => qi.quoteId !== quoteId);
    params.items.forEach((item) => {
      const appliedModality = item.appliedModality || (selectedPlan ? 'PLAN_SEGURO' : 'PARTICULAR');
      const appliedPlanId =
        item.appliedPlanId !== undefined
          ? item.appliedPlanId
          : appliedModality === 'PLAN_SEGURO'
            ? selectedPlan?.id || null
            : null;
      const appliedPlanName =
        item.appliedPlanName !== undefined
          ? item.appliedPlanName
          : appliedPlanId
            ? (data.insurancePlans || []).find((p) => p.id === appliedPlanId)?.name || null
            : null;
      const origListPrice = item.originalListPrice ?? item.unitPrice;

      data.quoteItems.push({
        id: crypto.randomUUID(),
        quoteId: q.id,
        serviceId: item.serviceId || null,
        toothNumber: item.toothNumber || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal || item.quantity * item.unitPrice,
        appliedModality,
        appliedPlanId,
        appliedPlanName,
        originalListPrice: origListPrice,
      });
    });
  }

  if (params.branchId) q.branchId = params.branchId;
  if (params.patientId) q.patientId = params.patientId;
  if (params.odontologistId !== undefined) q.odontologistId = params.odontologistId;
  if (params.planId !== undefined) {
    q.planId = selectedPlan ? selectedPlan.id : null;
    q.planName = selectedPlan ? selectedPlan.name : null;
  }
  if (params.validUntil !== undefined) q.validUntil = params.validUntil;
  if (params.notes !== undefined) q.notes = params.notes;
  q.updatedAt = new Date();

  data.quotes = data.quotes.map((item, idx) => (idx === qIndex ? q : item));

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: q.branchId,
    userId: params.actorUserId || data.users[0]?.id,
    action: 'UPDATE',
    entity: 'QUOTE',
    entityId: quoteId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Quotes Engine',
    oldValues: null,
    newValues: { quoteNumber: q.quoteNumber, finalAmount: q.finalAmount, planId: q.planId },
    description: `Presupuesto ${q.quoteNumber} actualizado correctamente.`,
    createdAt: new Date(),
  });

  ctx.notify();
  return q;
}

export function updateQuoteStatus(
  ctx: StoreContext,
  quoteId: string,
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'VENCIDO',
  actorUserId?: string,
  autoCreateTreatment: boolean = true
) {
  const data = ctx.getData();
  const q = (data.quotes || []).find((quote) => quote.id === quoteId);
  if (!q) return null;

  const oldStatus = q.status;
  if (oldStatus === status) {
    const existingTreatment = (data.treatments || []).find((t) => t.quoteId === quoteId);
    return { quote: q, treatment: existingTreatment || null };
  }

  q.status = status;
  q.updatedAt = new Date();

  let createdTreatment = null;

  if (status === 'APROBADO' && autoCreateTreatment) {
    const existingTreatment = (data.treatments || []).find((t) => t.quoteId === quoteId);
    if (existingTreatment) {
      createdTreatment = existingTreatment;
    } else {
      const items = (data.quoteItems || []).filter((it) => it.quoteId === quoteId);
      const toothNumbers = items
        .map((it) => it.toothNumber)
        .filter((tn): tn is number => tn !== null && tn !== undefined);

      const patient = (data.patients || []).find((p) => p.id === q.patientId);
      const resolvedPlanId =
        q.planId !== undefined
          ? q.planId || null
          : patient?.modality === 'PLAN_SEGURO'
            ? patient?.insurancePlanId || null
            : null;
      const plan = resolvedPlanId
        ? (data.insurancePlans || []).find((p) => p.id === resolvedPlanId)
        : null;
      const itemsOrigSum = items.reduce(
        (sum, it) =>
          sum + Number((it as any).originalListPrice ?? it.unitPrice ?? 0) * Math.max(1, Number(it.quantity || 1)),
        0
      );
      const origListPrice = Math.max(itemsOrigSum, Number(q.totalAmount ?? q.finalAmount ?? 0));

      createdTreatment = ctx.addTreatment({
        patientId: q.patientId,
        branchId: q.branchId,
        serviceId: items[0]?.serviceId || undefined,
        title: `Plan Presupuesto ${q.quoteNumber} (${items[0]?.description || 'Odontología Integral'})`,
        totalAmount: q.finalAmount,
        paidAmount: 0,
        toothNumbers,
        odontologistId: q.odontologistId || undefined,
        quoteId: q.id,
        status: 'EN_PROGRESO',
        startDate: getTodayAsuncionISO(),
        appliedModality: resolvedPlanId ? 'PLAN_SEGURO' : 'PARTICULAR',
        appliedPlanId: resolvedPlanId || undefined,
        appliedPlanName: q.planName || plan?.name || undefined,
        originalListPrice: origListPrice,
        notes: `Generado automáticamente por aprobación del presupuesto ${q.quoteNumber}`,
        actorUserId,
      });
    }
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: q.branchId,
    userId: actorUserId || data.users[0]?.id,
    action: 'STATUS_CHANGE',
    entity: 'QUOTE',
    entityId: quoteId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Quotes Engine',
    oldValues: { status: oldStatus },
    newValues: { status, generatedTreatmentId: createdTreatment?.id },
    description: `Presupuesto ${q.quoteNumber} actualizado a estado "${status}"`,
    createdAt: new Date(),
  });

  ctx.notify();
  return { quote: q, treatment: createdTreatment };
}

export function openCashRegister(
  ctx: StoreContext,
  params: {
    branchId: string;
    openingAmount: number;
    observations?: string;
    actorUserId: string;
  }
) {
  const data = ctx.getData();
  if (!data.cashRegisters) {
    data.cashRegisters = [];
  }

  const openingAmount = Number(params.openingAmount);
  if (!Number.isFinite(openingAmount) || openingAmount < 0) {
    throw new Error('El fondo de apertura debe ser mayor o igual a ₲ 0.');
  }
  if (!Number.isInteger(openingAmount)) {
    throw new Error('El fondo de apertura en Guaraníes (PYG) no admite decimales.');
  }

  const openRegister = data.cashRegisters.find((cr) => cr.branchId === params.branchId && cr.status === 'ABIERTA');
  if (openRegister) {
    throw new Error(
      'Ya existe una caja abierta en esta sucursal. Debe cerrar la caja activa antes de abrir un nuevo turno.'
    );
  }

  const id = crypto.randomUUID();
  const newRegister = {
    id,
    organizationId: data.organization.id,
    branchId: params.branchId,
    openedBy: params.actorUserId,
    closedBy: null,
    openingAmount: params.openingAmount,
    closingAmountExpected: null,
    closingAmountReal: null,
    differenceAmount: null,
    status: 'ABIERTA',
    openedAt: new Date(),
    closedAt: null,
    observations: params.observations || 'Apertura de turno.',
  };

  data.cashRegisters.unshift(newRegister);

  const user = data.users.find((u) => u.id === params.actorUserId);
  const branch = data.branches.find((b) => b.id === params.branchId);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: params.branchId,
    userId: params.actorUserId,
    action: 'OPEN_CASH_REGISTER',
    entity: 'CASH_REGISTER',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Cash Engine',
    oldValues: null,
    newValues: { openingAmount: params.openingAmount },
    description: `Apertura de caja en ${branch?.name} con fondo de ₲ ${params.openingAmount.toLocaleString('es-PY')} por ${user?.firstName} ${user?.lastName}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newRegister;
}

export function addCashMovement(
  ctx: StoreContext,
  params: {
    cashRegisterId: string;
    movementType: 'INGRESO' | 'EGRESO' | 'AJUSTE';
    amount: number;
    paymentMethod: string;
    concept: string;
    referenceNumber?: string;
    receiptNumber?: string;
    patientId?: string;
    treatmentId?: string;
    appointmentId?: string;
    actorUserId: string;
  }
) {
  const data = ctx.getData();
  if (!data.cashMovements) {
    data.cashMovements = [];
  }

  const register = (data.cashRegisters || []).find((cr) => cr.id === params.cashRegisterId);
  if (!register || register.status !== 'ABIERTA') {
    throw new Error('La caja especificada no existe o se encuentra cerrada.');
  }

  const validatedAmount = validatePygPrice(params.amount, 'El monto del movimiento');

  const id = crypto.randomUUID();
  const newMovement = {
    id,
    cashRegisterId: params.cashRegisterId,
    movementType: params.movementType,
    amount: validatedAmount,
    paymentMethod: params.paymentMethod,
    concept: params.concept,
    referenceNumber: params.referenceNumber || null,
    performedBy: params.actorUserId,
    createdAt: new Date(),
  };

  data.cashMovements.unshift(newMovement);

  // Solo emitir recibo en payments cuando exista paciente o tratamiento explícito (nunca asignar al primer paciente al azar)
  const linkedTreatment = params.treatmentId
    ? (data.treatments || []).find((t) => t.id === params.treatmentId)
    : null;
  const patientIdResolved = params.patientId || linkedTreatment?.patientId || null;

  if (params.movementType === 'INGRESO' && patientIdResolved) {
    if (!data.payments) {
      data.payments = [];
    }
    const payId = crypto.randomUUID();
    data.payments.unshift({
      id: payId,
      organizationId: data.organization.id,
      branchId: register.branchId,
      patientId: patientIdResolved,
      treatmentId: params.treatmentId || null,
      appointmentId: params.appointmentId || null,
      cashMovementId: id,
      receiptNumber: params.receiptNumber || ctx.getNextReceiptNumber(),
      invoiceNumber: ctx.getNextInvoiceNumber(),
      amount: validatedAmount,
      paymentMethod: params.paymentMethod,
      status: 'COMPLETADO',
      notes: params.concept,
      receivedBy: params.actorUserId,
      createdAt: new Date(),
    });

    if (validatedAmount > 0) {
      const linkedQuote = linkedTreatment?.quoteId
        ? (data.quotes || []).find((q) => q.id === linkedTreatment.quoteId)
        : null;
      evaluateCommissionsForEvent(data, {
        eventType: 'PAYMENT_COLLECTED',
        organizationId: data.organization.id,
        branchId: register.branchId,
        patientId: patientIdResolved,
        quoteId: linkedTreatment?.quoteId || null,
        treatmentId: params.treatmentId || null,
        paymentId: payId,
        odontologistUserId: linkedQuote?.odontologistId || null,
        amount: validatedAmount,
        actorUserId: params.actorUserId,
      });
    }
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: register.branchId,
    userId: params.actorUserId,
    action: 'CASH_MOVEMENT',
    entity: 'CASH_MOVEMENT',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Cash Engine',
    oldValues: null,
    newValues: {
      movementType: params.movementType,
      amount: validatedAmount,
      paymentMethod: params.paymentMethod,
      concept: params.concept,
    },
    description: `Movimiento de caja (${params.movementType}): ${params.concept} - ${formatPYG(validatedAmount)} (${params.paymentMethod})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newMovement;
}

export function closeCashRegister(
  ctx: StoreContext,
  params: {
    cashRegisterId: string;
    closingAmountReal: number;
    observations?: string;
    actorUserId: string;
  }
) {
  const data = ctx.getData();
  const register = (data.cashRegisters || []).find((cr) => cr.id === params.cashRegisterId);
  if (!register) throw new Error('Caja no encontrada.');
  if (register.status === 'CERRADA') throw new Error('Esta caja ya ha sido cerrada.');
  if (!Number.isFinite(params.closingAmountReal) || !Number.isInteger(params.closingAmountReal) || params.closingAmountReal < 0) {
    throw new Error('El monto físico contado en Guaraníes (PYG) debe ser un entero mayor o igual a ₲ 0.');
  }

  const movements = (data.cashMovements || []).filter((m) => m.cashRegisterId === params.cashRegisterId);
  const cashIngresos = movements
    .filter((m) => m.movementType === 'INGRESO' && m.paymentMethod === 'EFECTIVO')
    .reduce((sum, m) => sum + m.amount, 0);

  const cashEgresos = movements
    .filter((m) => m.movementType === 'EGRESO' && m.paymentMethod === 'EFECTIVO')
    .reduce((sum, m) => sum + m.amount, 0);

  const expectedCash = register.openingAmount + cashIngresos - cashEgresos;
  const difference = params.closingAmountReal - expectedCash;

  register.status = 'CERRADA';
  register.closedBy = params.actorUserId;
  register.closedAt = new Date();
  register.closingAmountExpected = expectedCash;
  register.closingAmountReal = params.closingAmountReal;
  register.differenceAmount = difference;
  if (params.observations) {
    register.observations = (register.observations ? register.observations + ' | ' : '') + params.observations;
  }

  const branch = data.branches.find((b) => b.id === register.branchId);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: register.branchId,
    userId: params.actorUserId,
    action: 'CLOSE_CASH_REGISTER',
    entity: 'CASH_REGISTER',
    entityId: register.id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Cash Engine',
    oldValues: { status: 'ABIERTA', openingAmount: register.openingAmount },
    newValues: {
      expectedCash,
      closingAmountReal: params.closingAmountReal,
      difference,
    },
    description: `Cierre de caja en ${branch?.name}. Esperado: ₲ ${expectedCash.toLocaleString('es-PY')} | Real: ₲ ${params.closingAmountReal.toLocaleString('es-PY')} (Diferencia: ₲ ${difference.toLocaleString('es-PY')})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return register;
}
