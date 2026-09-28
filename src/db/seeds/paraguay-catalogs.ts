// ============================================================================
// CATÁLOGOS OFICIALES Y DATOS MAESTROS DE PARAGUAY
// ============================================================================

export interface ParaguayDepartment {
  code: string;
  name: string;
  capital: string;
  cities: string[];
}

export const PARAGUAY_DEPARTMENTS: ParaguayDepartment[] = [
  {
    code: 'ASU',
    name: 'Asunción (Distrito Capital)',
    capital: 'Asunción',
    cities: [
      'Asunción (Centro)',
      'Villa Morra',
      'Carmelitas',
      'Sajonia',
      'Barrio Obrero',
      'Mburucuyá',
      'Recoleta',
      'Los Laureles',
      'Trinidad',
      'Zeballos Cué'
    ],
  },
  {
    code: 'CEN',
    name: 'Central',
    capital: 'Areguá',
    cities: [
      'San Lorenzo',
      'Luque',
      'Fernando de la Mora',
      'Lambaré',
      'Capiatá',
      'Mariano Roque Alonso',
      'Ñemby',
      'Villa Elisa',
      'Limpio',
      'Itauguá',
      'San Antonio',
      'Areguá',
      'Ypané',
      'J. Augusto Saldívar',
      'Guarambaré',
      'Villeta',
      'Itá'
    ],
  },
  {
    code: 'ALP',
    name: 'Alto Paraná',
    capital: 'Ciudad del Este',
    cities: [
      'Ciudad del Este',
      'Hernandarias',
      'Presidente Franco',
      'Minga Guazú',
      'Santa Rita',
      'Doctor Juan León Mallorquín'
    ],
  },
  {
    code: 'ITA',
    name: 'Itapúa',
    capital: 'Encarnación',
    cities: [
      'Encarnación',
      'Cambyretá',
      'Hohenau',
      'Obligado',
      'Bella Vista',
      'Coronel Bogado',
      'Fram'
    ],
  },
  {
    code: 'CAA',
    name: 'Caaguazú',
    capital: 'Coronel Oviedo',
    cities: [
      'Coronel Oviedo',
      'Caaguazú',
      'Doctor Juan Manuel Frutos',
      'San José de los Arroyos',
      'Yhú'
    ],
  },
  {
    code: 'CRD',
    name: 'Cordillera',
    capital: 'Caacupé',
    cities: [
      'Caacupé',
      'San Bernardino',
      'Tobatí',
      'Piribebuy',
      'Altos',
      'Atyrá',
      'Eusebio Ayala',
      'Itacurubí de la Cordillera'
    ],
  },
  {
    code: 'GUA',
    name: 'Guairá',
    capital: 'Villarrica',
    cities: ['Villarrica', 'Colonia Independencia', 'Paso Yobái', 'Mbocayaty'],
  },
  {
    code: 'PAR',
    name: 'Paraguarí',
    capital: 'Paraguarí',
    cities: ['Paraguarí', 'Carapeguá', 'Yaguarón', 'Quiindy', 'Pirayú'],
  },
  {
    code: 'CON',
    name: 'Concepción',
    capital: 'Concepción',
    cities: ['Concepción', 'Horqueta', 'Belén', 'Loreto', 'Yby Yaú'],
  },
  {
    code: 'SPA',
    name: 'San Pedro',
    capital: 'San Pedro de Ycuamandiyú',
    cities: ['San Pedro', 'Santa Rosa del Aguaray', 'San Estanislao (Santaní)', 'Guayaibí'],
  },
  {
    code: 'AMB',
    name: 'Amambay',
    capital: 'Pedro Juan Caballero',
    cities: ['Pedro Juan Caballero', 'Bella Vista Norte', 'Capitán Bado'],
  },
  {
    code: 'CAN',
    name: 'Canindeyú',
    capital: 'Salto del Guairá',
    cities: ['Salto del Guairá', 'Curuguaty', 'Katueté', 'La Paloma'],
  },
  {
    code: 'MIS',
    name: 'Misiones',
    capital: 'San Juan Bautista',
    cities: ['San Juan Bautista', 'San Ignacio', 'Ayolas', 'Santa Rosa'],
  },
  {
    code: 'NEE',
    name: 'Ñeembucú',
    capital: 'Pilar',
    cities: ['Pilar', 'Alberdi', 'Humaitá'],
  },
  {
    code: 'CAZ',
    name: 'Caazapá',
    capital: 'Caazapá',
    cities: ['Caazapá', 'San Juan Nepomuceno', 'Yuty'],
  },
  {
    code: 'PHAY',
    name: 'Presidente Hayes',
    capital: 'Villa Hayes',
    cities: ['Villa Hayes', 'Benjamín Aceval', 'Nanawa'],
  },
  {
    code: 'BOQ',
    name: 'Boquerón',
    capital: 'Filadelfia',
    cities: ['Filadelfia', 'Neuland', 'Loma Plata', 'Mariscal Estigarribia'],
  },
  {
    code: 'APC',
    name: 'Alto Paraguay',
    capital: 'Fuerte Olimpo',
    cities: ['Fuerte Olimpo', 'Bahía Negra', 'Puerto Casado'],
  }
];

export const DOCUMENT_TYPES = [
  { code: 'CI', label: 'Cédula de Identidad (C.I.)', placeholder: 'Ej. 4.250.312 o 4250312' },
  { code: 'RUC', label: 'R.U.C. (Registro Único de Contribuyente)', placeholder: 'Ej. 4250312-3' },
  { code: 'PASAPORTE', label: 'Pasaporte', placeholder: 'Ej. N1234567' },
  { code: 'OTRO', label: 'Otro / Extranjero', placeholder: 'Documento extranjero' },
];

export const PAYMENT_METHODS = [
  { code: 'EFECTIVO', label: 'Efectivo (Guaraníes ₲)', icon: 'banknote' },
  { code: 'TRANSFERENCIA_SIPAP', label: 'Transferencia Bancaria (SIPAP)', icon: 'building-2' },
  { code: 'QR_BANCARIO', label: 'Pago con QR Bancario (Bancard / Dinelco)', icon: 'qr-code' },
  { code: 'TARJETA_DEBITO', label: 'Tarjeta de Débito', icon: 'credit-card' },
  { code: 'TARJETA_CREDITO', label: 'Tarjeta de Crédito', icon: 'credit-card' },
  { code: 'BILLETERA_DIGITAL', label: 'Billetera Móvil (Tigo Money / Zimple)', icon: 'smartphone' },
];

export const BASE_ROLES = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Administrador',
    description: 'Acceso total multiorganización y multisucursal, configuración del sistema, auditoría.',
    isSystem: true,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'odontogram', 'treatments', 'clinical', 'quotes', 'cash', 'branches', 'organization', 'users', 'audit', 'production', 'security', 'testing', 'auth-session', 'database', 'data-explorer', 'paraguay', 'architecture', 'roadmap'],
  },
  {
    id: 'ADMIN_ORGANIZACION',
    name: 'Administrador de Organización',
    description: 'Administración integral de su empresa médica, gestión de sucursales, finanzas y personal asignado, sin acceso a unidades de negocio ni configuración de branding global.',
    isSystem: true,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'odontogram', 'treatments', 'clinical', 'quotes', 'cash', 'branches', 'users', 'audit'],
  },
  {
    id: 'ADMIN_SUCURSAL',
    name: 'Administrador de Sucursal',
    description: 'Gestión operativa, reportes, caja, personal y agendas exclusivamente dentro de su/s sucursal/es asignadas.',
    isSystem: true,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'odontogram', 'treatments', 'clinical', 'quotes', 'cash', 'branches', 'users', 'audit'],
  },
  {
    id: 'SUPERVISOR',
    name: 'Supervisor General / Auditor Clínico',
    description: 'Supervisión de operaciones de sucursales, control de calidad médica, auditoría de cajas y rendimiento.',
    isSystem: false,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'odontogram', 'treatments', 'clinical', 'quotes', 'cash', 'branches', 'users', 'audit'],
  },
  {
    id: 'VENDEDOR',
    name: 'Vendedor / Asesor de Tratamientos',
    description: 'Cotizaciones, cierre de planes dentales, seguimiento comercial de pacientes, presupuestos y promociones.',
    isSystem: false,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'quotes'],
  },
  {
    id: 'ODONTOLOGO',
    name: 'Odontólogo / Especialista',
    description: 'Atención clínica, odontograma digital, fichas clínicas, recetas y evolución de pacientes.',
    isSystem: true,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'odontogram', 'treatments', 'clinical', 'quotes'],
  },
  {
    id: 'RECEPCION',
    name: 'Recepcionista / Secretaria',
    description: 'Gestión de turnos y agendas, registro de pacientes, recepción en sala de espera.',
    isSystem: true,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'quotes', 'cash'],
  },
  {
    id: 'CAJA',
    name: 'Cajero / Facturación',
    description: 'Cobros, apertura y cierre de caja chica, emisión de recibos y facturas fiscales.',
    isSystem: true,
    allowedNavTabs: ['dashboard', 'cash', 'quotes'],
  },
  {
    id: 'ASISTENTE',
    name: 'Asistente Dental / Auxiliar',
    description: 'Apoyo en box odontológico, preparación de instrumental, consulta de pacientes y soporte operativo.',
    isSystem: true,
    allowedNavTabs: ['dashboard', 'appointments', 'patients', 'treatments'],
  },
];

export const STANDARD_SERVICES = [
  {
    category: 'Diagnóstico y Prevención',
    code: 'DIAG-01',
    name: 'Consulta y Diagnóstico Clínico',
    description: 'Evaluación bucodental completa, odontograma diagnóstico y plan de tratamiento.',
    defaultDurationMin: 30,
    basePrice: 120000, // ₲ 120.000
  },
  {
    category: 'Diagnóstico y Prevención',
    code: 'PREV-01',
    name: 'Limpieza Bucal Profunda (Tartrectomía con Ultrasonido)',
    description: 'Profilaxis dental completa, eliminación de tártaro con ultrasonido y pulido coronario.',
    defaultDurationMin: 45,
    basePrice: 180000, // ₲ 180.000
  },
  {
    category: 'Operatoria Dental',
    code: 'REST-01',
    name: 'Restauración con Resina Compuesta Simple',
    description: 'Obturación estética con resina fotopolimerizable en 1 superficie dental.',
    defaultDurationMin: 45,
    basePrice: 190000, // ₲ 190.000
  },
  {
    category: 'Operatoria Dental',
    code: 'REST-02',
    name: 'Restauración con Resina Compuesta Compleja',
    description: 'Reconstrucción estética en 2 o más superficies dentales con resina de alta resistencia.',
    defaultDurationMin: 60,
    basePrice: 260000, // ₲ 260.000
  },
  {
    category: 'Endodoncia',
    code: 'ENDO-01',
    name: 'Tratamiento de Conducto (Unirradicular)',
    description: 'Biopulpectomía o necropulpectomía en pieza unirradicular con instrumentación mecanizada.',
    defaultDurationMin: 60,
    basePrice: 550000, // ₲ 550.000
  },
  {
    category: 'Endodoncia',
    code: 'ENDO-02',
    name: 'Tratamiento de Conducto (Multirradicular / Molar)',
    description: 'Tratamiento endodóntico complejo en molares con sellado tridimensional.',
    defaultDurationMin: 90,
    basePrice: 850000, // ₲ 850.000
  },
  {
    category: 'Ortodoncia',
    code: 'ORTO-01',
    name: 'Instalación de Brackets Metálicos (Parcial/Completo)',
    description: 'Colocación de aparatología fija metálica de alta precisión para alineación dental.',
    defaultDurationMin: 60,
    basePrice: 1200000, // ₲ 1.200.000
  },
  {
    category: 'Ortodoncia',
    code: 'ORTO-02',
    name: 'Control Mensual de Ortodoncia',
    description: 'Ajuste de arcos, cambio de ligaduras elásticas y seguimiento de evolución.',
    defaultDurationMin: 30,
    basePrice: 180000, // ₲ 180.000
  },
  {
    category: 'Cirugía Bucal',
    code: 'CIRU-01',
    name: 'Extracción Dental Simple',
    description: 'Exodoncia de pieza dental erupcionada sin complicaciones osteotomómicas.',
    defaultDurationMin: 45,
    basePrice: 200000, // ₲ 200.000
  },
  {
    category: 'Cirugía Bucal',
    code: 'CIRU-02',
    name: 'Cirugía de Tercer Molar (Muela del Juicio Retenida)',
    description: 'Exodoncia quirúrgica de cordal impactado/retenido con sutura reabsorbible.',
    defaultDurationMin: 60,
    basePrice: 650000, // ₲ 650.000
  },
  {
    category: 'Estética Dental',
    code: 'ESTE-01',
    name: 'Blanqueamiento Dental en Consultorio (Luz LED)',
    description: 'Aclaramiento dental intensivo en sillón con peróxido de hidrógeno y luz fría.',
    defaultDurationMin: 60,
    basePrice: 800000, // ₲ 800.000
  },
  {
    category: 'Implantología',
    code: 'IMPL-01',
    name: 'Implante Dental de Titanio (Fase Quirúrgica)',
    description: 'Fijación de implante biocompatible de titanio grado médico en lecho óseo.',
    defaultDurationMin: 75,
    basePrice: 3200000, // ₲ 3.200.000
  }
];

// Helper para formatear montos en Guaraníes (PYG) sin centavos con separador de miles
export function formatPYG(amount: number | bigint): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  return `₲ ${new Intl.NumberFormat('es-PY').format(num)}`;
}

// Validador de RUC paraguayo (algoritmo Módulo 11 oficial de la SET / DNIT)
export function calculateRucVerificationDigit(numero: string): number {
  const cleanNumber = numero.replace(/\D/g, '');
  let k = 2;
  let total = 0;

  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    total += parseInt(cleanNumber[i], 10) * k;
    k = k === 11 ? 2 : k + 1;
  }

  const resto = total % 11;
  return resto > 1 ? 11 - resto : 0;
}
