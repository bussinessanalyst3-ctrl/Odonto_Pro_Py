import { BASE_ROLES, STANDARD_SERVICES, PARAGUAY_DEPARTMENTS } from './paraguay-catalogs.ts';
import { ROLE_HIERARCHY } from '../../security/rbacHierarchy.ts';

export interface SeedDataResult {
  organization: any;
  branches: any[];
  branchSettings: any[];
  dentalChairs: any[];
  roles: any[];
  users: any[];
  userBranches: any[];
  services: any[];
  branchServices: any[];
  patients: any[];
  patientBranches: any[];
  appointments: any[];
  clinicalRecords: any[];
  odontograms: any[];
  odontogramItems: any[];
  quotes: any[];
  quoteItems: any[];
  treatments: any[];
  cashRegisters: any[];
  cashMovements: any[];
  payments: any[];
  auditLogs: any[];
}

export function generateInitialSeedData(): SeedDataResult {
  const orgId = '11111111-1111-4111-8111-111111111111';
  
  // 1. Organización
  const organization = {
    id: orgId,
    code: 'ODONTOSOL-PY',
    name: 'Clínica Odontológica OdontoSol S.R.L.',
    legalName: 'OdontoSol Servicios Odontológicos Integrales S.R.L.',
    taxId: '80098765-4', // RUC Paraguay
    countryCode: 'PRY',
    defaultCurrency: 'PYG',
    timezone: 'America/Asuncion',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
    updatedAt: new Date('2026-01-10T08:00:00.000Z'),
  };

  // 2. Sucursales
  const branchAsuId = '22222222-2222-4222-8222-222222222221';
  const branchSloId = '22222222-2222-4222-8222-222222222222';
  const branchLuqId = '22222222-2222-4222-8222-222222222223';

  const branches = [
    {
      id: branchAsuId,
      organizationId: orgId,
      code: 'SUC-ASU-01',
      name: 'Sucursal Asunción Centro',
      department: 'Asunción (Distrito Capital)',
      city: 'Asunción (Centro)',
      neighborhood: 'La Encarnación',
      address: 'Calle Palma 745 c/ Ayolas - Edificio Palma Real, Piso 2',
      phone: '+595 21 445 890',
      whatsapp: '+595 981 550 120',
      email: 'asuncion@odontosol.com.py',
      openingTime: '07:30:00',
      closingTime: '19:30:00',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-15T08:00:00.000Z'),
      updatedAt: new Date('2026-01-15T08:00:00.000Z'),
    },
    {
      id: branchSloId,
      organizationId: orgId,
      code: 'SUC-SLO-02',
      name: 'Sucursal San Lorenzo',
      department: 'Central',
      city: 'San Lorenzo',
      neighborhood: 'San Pedro',
      address: 'Ruta Mcal. Estigarribia Km 14.5 c/ Julia Miranda Cueto',
      phone: '+595 21 582 340',
      whatsapp: '+595 971 880 230',
      email: 'sanlorenzo@odontosol.com.py',
      openingTime: '08:00:00',
      closingTime: '19:00:00',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-20T08:00:00.000Z'),
      updatedAt: new Date('2026-01-20T08:00:00.000Z'),
    },
    {
      id: branchLuqId,
      organizationId: orgId,
      code: 'SUC-LUQ-03',
      name: 'Sucursal Luque',
      department: 'Central',
      city: 'Luque',
      neighborhood: 'Cuarto Barrio',
      address: 'Avda. Corrales 312 c/ Cerro Corá',
      phone: '+595 21 643 110',
      whatsapp: '+595 982 770 450',
      email: 'luque@odontosol.com.py',
      openingTime: '08:00:00',
      closingTime: '18:30:00',
      status: 'ACTIVE',
      createdAt: new Date('2026-02-01T08:00:00.000Z'),
      updatedAt: new Date('2026-02-01T08:00:00.000Z'),
    }
  ];

  const branchSettings = branches.map(b => ({
    branchId: b.id,
    appointmentDurationDefault: 30,
    slotInterval: 15,
    allowDoubleBooking: false,
    requireDocumentOnBooking: true,
    createdAt: new Date('2026-01-15T08:00:00.000Z'),
    updatedAt: new Date('2026-01-15T08:00:00.000Z'),
  }));

  // 2.1 Sillones Dentales (Dental Chairs) por Sucursal
  const chairAsu1 = '99999999-9999-4999-8999-999999999001';
  const chairAsu2 = '99999999-9999-4999-8999-999999999002';
  const chairSlo1 = '99999999-9999-4999-8999-999999999003';
  const chairSlo2 = '99999999-9999-4999-8999-999999999004';
  const chairLuq1 = '99999999-9999-4999-8999-999999999005';

  const dentalChairs = [
    {
      id: chairAsu1,
      organizationId: orgId,
      branchId: branchAsuId,
      name: 'Sillón 1 (Principal)',
      code: 'S1-ASU',
      room: 'Box Odontológico A',
      status: 'OPERATIVE',
      colorTag: 'teal',
      createdAt: new Date('2026-01-15T08:00:00.000Z'),
      updatedAt: new Date('2026-01-15T08:00:00.000Z'),
    },
    {
      id: chairAsu2,
      organizationId: orgId,
      branchId: branchAsuId,
      name: 'Sillón 2 (Quirúrgico/Endodoncia)',
      code: 'S2-ASU',
      room: 'Box Quirófano Menor B',
      status: 'OPERATIVE',
      colorTag: 'indigo',
      createdAt: new Date('2026-01-15T08:00:00.000Z'),
      updatedAt: new Date('2026-01-15T08:00:00.000Z'),
    },
    {
      id: chairSlo1,
      organizationId: orgId,
      branchId: branchSloId,
      name: 'Sillón 1 (General)',
      code: 'S1-SLO',
      room: 'Consultorio San Lorenzo 1',
      status: 'OPERATIVE',
      colorTag: 'teal',
      createdAt: new Date('2026-01-20T08:00:00.000Z'),
      updatedAt: new Date('2026-01-20T08:00:00.000Z'),
    },
    {
      id: chairSlo2,
      organizationId: orgId,
      branchId: branchSloId,
      name: 'Sillón 2 (Ortodoncia)',
      code: 'S2-SLO',
      room: 'Consultorio San Lorenzo 2',
      status: 'OPERATIVE',
      colorTag: 'amber',
      createdAt: new Date('2026-01-20T08:00:00.000Z'),
      updatedAt: new Date('2026-01-20T08:00:00.000Z'),
    },
    {
      id: chairLuq1,
      organizationId: orgId,
      branchId: branchLuqId,
      name: 'Sillón 1 (Integral)',
      code: 'S1-LUQ',
      room: 'Consultorio Luque A',
      status: 'OPERATIVE',
      colorTag: 'emerald',
      createdAt: new Date('2026-02-01T08:00:00.000Z'),
      updatedAt: new Date('2026-02-01T08:00:00.000Z'),
    }
  ];

  // 3. Roles
  const roles = BASE_ROLES.map(r => ({
    ...r,
    permissions: ROLE_HIERARCHY[r.id]?.permissions ? [...ROLE_HIERARCHY[r.id].permissions] : [],
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
  }));

  // 4. Usuarios (Jerarquía RBAC Completa y Protegida)
  const userOwnerAdminId = '33333333-3333-4333-8333-333333333330';
  const userAdminId = '33333333-3333-4333-8333-333333333331';
  const userOrgAdminId = '33333333-3333-4333-8333-333333333334';
  const userBranchAdminId = '33333333-3333-4333-8333-333333333335';
  const userDentistId = '33333333-3333-4333-8333-333333333332';
  const userCashierId = '33333333-3333-4333-8333-333333333333';
  const userReceptionId = '33333333-3333-4333-8333-333333333336';

  const users = [
    {
      id: userOwnerAdminId,
      organizationId: orgId,
      roleId: 'SUPER_ADMIN',
      username: 'bussinessanalyst3',
      firstName: 'Business Analyst',
      lastName: 'Administrador Principal',
      email: 'bussinessanalyst3@gmail.com',
      passwordHash: 'cff443a9ff9e703b0965c3bd6b7250781659fa213d237a39254f8a2927570691',
      passwordSalt: 'dc7b5474eb79d83062d731f1e0932f26',
      passwordIterations: 100000,
      phone: '+595 981 100 200',
      professionalLicense: null,
      specialty: 'Dirección General & Auditoría Global',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      createdAt: new Date('2026-01-08T08:00:00.000Z'),
      updatedAt: new Date('2026-01-08T08:00:00.000Z'),
    },
    {
      id: userAdminId,
      organizationId: orgId,
      roleId: 'SUPER_ADMIN',
      username: 'lucas.arrua',
      firstName: 'Lucas Eliezer',
      lastName: 'Arrua Almada',
      email: 'lucas.arrua@odontosol.com.py',
      passwordHash: '59a71110adc2f24254181100c744d6289ff20f2bb204d6a3d1092f2ce8e162c1',
      passwordSalt: '428f297dfd1ecf1e754760911656a565',
      passwordIterations: 100000,
      phone: '+595 981 123 456',
      professionalLicense: null,
      specialty: 'Dirección General & Auditoría Global',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      createdAt: new Date('2026-01-10T08:00:00.000Z'),
      updatedAt: new Date('2026-01-10T08:00:00.000Z'),
    },
    {
      id: userOrgAdminId,
      organizationId: orgId,
      roleId: 'ADMIN_ORGANIZACION',
      username: 'sofia.benitez',
      firstName: 'Lic. Sofía',
      lastName: 'Benítez Cantero',
      email: 'sofia.benitez@odontosol.com.py',
      passwordHash: 'cc7eed037ae593c4c539d73bc34dcea0da3900333861712208d44ade1c1a27df',
      passwordSalt: 'b20f2067ee4b242a71f0ec5393c9517f',
      passwordIterations: 100000,
      phone: '+595 981 444 555',
      professionalLicense: null,
      specialty: 'Gerencia Administrativa y Finanzas',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      createdAt: new Date('2026-01-12T08:00:00.000Z'),
      updatedAt: new Date('2026-01-12T08:00:00.000Z'),
    },
    {
      id: userBranchAdminId,
      organizationId: orgId,
      roleId: 'ADMIN_SUCURSAL',
      username: 'marcos.vega',
      firstName: 'Marcos',
      lastName: 'Vega Portillo',
      email: 'marcos.vega@odontosol.com.py',
      passwordHash: 'e2013e4b2419fc0377517b01f2542d32451f5a6a534399416b4eae7d36e5aa06',
      passwordSalt: '9220793fd6c39187ee0ecc886bfaebcd',
      passwordIterations: 100000,
      phone: '+595 981 888 999',
      professionalLicense: null,
      specialty: 'Administración de Sede San Lorenzo',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      createdAt: new Date('2026-01-14T08:00:00.000Z'),
      updatedAt: new Date('2026-01-14T08:00:00.000Z'),
    },
    {
      id: userDentistId,
      organizationId: orgId,
      roleId: 'ODONTOLOGO',
      username: 'valeria.gomez',
      firstName: 'Dra. Valeria',
      lastName: 'Gómez Benítez',
      email: 'valeria.gomez@odontosol.com.py',
      passwordHash: '66215299820b727075b9ca5aa2464d8ca60b37a7482573e4e7ff16e0658a40ac',
      passwordSalt: '4d875d080ea582880171bcd0693662da',
      passwordIterations: 100000,
      phone: '+595 982 777 888',
      professionalLicense: 'MSPBS N° 14.821 / Reg. Odontológico',
      specialty: 'Ortodoncia & Rehabilitación Oral',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      createdAt: new Date('2026-01-15T08:00:00.000Z'),
      updatedAt: new Date('2026-01-15T08:00:00.000Z'),
    },
    {
      id: userCashierId,
      organizationId: orgId,
      roleId: 'CAJA',
      username: 'carlos.mendoza',
      firstName: 'Carlos Alberto',
      lastName: 'Mendoza Duarte',
      email: 'carlos.mendoza@odontosol.com.py',
      passwordHash: 'a0ef7da80c8d2b91d6e742d85017f85c052a90be7acd1ec8e4cc07d2cb03009e',
      passwordSalt: '5afc6c5db4da31769a5ad9e583c1fa51',
      passwordIterations: 100000,
      phone: '+595 971 333 444',
      professionalLicense: null,
      specialty: 'Operaciones de Recaudación & Tesorería',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      createdAt: new Date('2026-01-18T08:00:00.000Z'),
      updatedAt: new Date('2026-01-18T08:00:00.000Z'),
    },
    {
      id: userReceptionId,
      organizationId: orgId,
      roleId: 'RECEPCION',
      username: 'ana.gimenez',
      firstName: 'Ana Sofía',
      lastName: 'Giménez Romero',
      email: 'ana.gimenez@odontosol.com.py',
      passwordHash: 'efbe3452fdf2acfadec5c2aa67fb229ef0aa9021f4aa87f2ceb4d4f7fae0015b',
      passwordSalt: 'eb6f10edbd6e832b0434efe501717c0b',
      passwordIterations: 100000,
      phone: '+595 981 222 333',
      professionalLicense: null,
      specialty: 'Recepción y Atención al Paciente',
      status: 'ACTIVE',
      lastLoginAt: new Date(),
      createdAt: new Date('2026-01-20T08:00:00.000Z'),
      updatedAt: new Date('2026-01-20T08:00:00.000Z'),
    }
  ];

  const userBranches = [
    { userId: userOwnerAdminId, branchId: branchAsuId, isDefault: true, createdAt: new Date() },
    { userId: userOwnerAdminId, branchId: branchSloId, isDefault: false, createdAt: new Date() },
    { userId: userOwnerAdminId, branchId: branchLuqId, isDefault: false, createdAt: new Date() },
    { userId: userAdminId, branchId: branchAsuId, isDefault: true, createdAt: new Date() },
    { userId: userAdminId, branchId: branchSloId, isDefault: false, createdAt: new Date() },
    { userId: userAdminId, branchId: branchLuqId, isDefault: false, createdAt: new Date() },
    { userId: userOrgAdminId, branchId: branchAsuId, isDefault: true, createdAt: new Date() },
    { userId: userOrgAdminId, branchId: branchSloId, isDefault: false, createdAt: new Date() },
    { userId: userOrgAdminId, branchId: branchLuqId, isDefault: false, createdAt: new Date() },
    // ADMIN_SUCURSAL asignado EXCLUSIVAMENTE a San Lorenzo
    { userId: userBranchAdminId, branchId: branchSloId, isDefault: true, createdAt: new Date() },
    { userId: userDentistId, branchId: branchAsuId, isDefault: true, createdAt: new Date() },
    { userId: userDentistId, branchId: branchSloId, isDefault: false, createdAt: new Date() },
    { userId: userCashierId, branchId: branchAsuId, isDefault: true, createdAt: new Date() },
    { userId: userReceptionId, branchId: branchAsuId, isDefault: true, createdAt: new Date() },
  ];

  // 5. Servicios Catálogo
  const services = STANDARD_SERVICES.map((s, idx) => ({
    id: `44444444-4444-4444-8444-444444444${String(idx + 1).padStart(3, '0')}`,
    organizationId: orgId,
    category: s.category,
    code: s.code,
    name: s.name,
    description: s.description,
    defaultDurationMin: s.defaultDurationMin,
    basePrice: s.basePrice,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-12T08:00:00.000Z'),
    updatedAt: new Date('2026-01-12T08:00:00.000Z'),
  }));

  const branchServices = branches.flatMap(branch =>
    services.map(svc => ({
      branchId: branch.id,
      serviceId: svc.id,
      customPrice: svc.basePrice,
      isAvailable: true,
    }))
  );

  // 6. Pacientes Paraguayos de Demostración
  const pat1Id = '55555555-5555-4555-8555-555555555551';
  const pat2Id = '55555555-5555-4555-8555-555555555552';
  const pat3Id = '55555555-5555-4555-8555-555555555553';
  const pat4Id = '55555555-5555-4555-8555-555555555554';

  const patients = [
    {
      id: pat1Id,
      organizationId: orgId,
      primaryBranchId: branchAsuId,
      documentType: 'CI',
      documentNumber: '4.382.910',
      firstName: 'Gustavo Adolfo',
      lastName: 'Caballero Paredes',
      birthDate: '1992-06-14',
      gender: 'MASCULINO',
      phone: '+595 981 445 901',
      whatsapp: '+595 981 445 901',
      email: 'gustavo.caballero@gmail.com',
      department: 'Asunción (Distrito Capital)',
      city: 'Asunción (Centro)',
      neighborhood: 'Sajonia',
      address: 'Avda. Carlos Antonio López 1240',
      emergencyContactName: 'Marta Paredes (Madre)',
      emergencyContactPhone: '+595 981 112 233',
      bloodType: 'O+',
      allergies: 'Penicilina (reacción cutánea)',
      medicalConditions: 'Ninguna',
      medications: 'Ninguna',
      status: 'ACTIVE',
      createdAt: new Date('2026-02-10T09:00:00.000Z'),
      updatedAt: new Date('2026-02-10T09:00:00.000Z'),
    },
    {
      id: pat2Id,
      organizationId: orgId,
      primaryBranchId: branchAsuId,
      documentType: 'CI',
      documentNumber: '3.729.104',
      firstName: 'Lourdes Patricia',
      lastName: 'Vera de Martínez',
      birthDate: '1987-11-23',
      gender: 'FEMENINO',
      phone: '+595 971 654 321',
      whatsapp: '+595 971 654 321',
      email: 'lourdes.vera@hotmail.com',
      department: 'Central',
      city: 'Fernando de la Mora',
      neighborhood: 'Zona Sur',
      address: 'Pitiantuta 589 c/ 11 de Septiembre',
      emergencyContactName: 'Ramón Martínez (Esposo)',
      emergencyContactPhone: '+595 971 998 811',
      bloodType: 'A+',
      allergies: 'Ninguna conocida',
      medicalConditions: 'Hipertensión controlada con Enalapril 10mg',
      medications: 'Enalapril 10mg / día',
      status: 'ACTIVE',
      createdAt: new Date('2026-02-14T10:30:00.000Z'),
      updatedAt: new Date('2026-02-14T10:30:00.000Z'),
    },
    {
      id: pat3Id,
      organizationId: orgId,
      primaryBranchId: branchSloId,
      documentType: 'CI',
      documentNumber: '5.102.834',
      firstName: 'Enzo Sebastián',
      lastName: 'Ayala Rojas',
      birthDate: '2001-03-08',
      gender: 'MASCULINO',
      phone: '+595 983 332 211',
      whatsapp: '+595 983 332 211',
      email: 'enzo.ayala@outlook.com',
      department: 'Central',
      city: 'San Lorenzo',
      neighborhood: 'Barcequillo',
      address: 'Calle Pastora Céspedes 450',
      emergencyContactName: 'Silvia Rojas (Madre)',
      emergencyContactPhone: '+595 983 999 111',
      bloodType: 'B+',
      allergies: 'Aspirina',
      medicalConditions: 'Asma bronquial leve',
      medications: 'Salbutamol aerosol SOS',
      status: 'ACTIVE',
      createdAt: new Date('2026-02-20T14:00:00.000Z'),
      updatedAt: new Date('2026-02-20T14:00:00.000Z'),
    },
    {
      id: pat4Id,
      organizationId: orgId,
      primaryBranchId: branchLuqId,
      documentType: 'CI',
      documentNumber: '4.891.220',
      firstName: 'Camila Raquel',
      lastName: 'Fernández Bogado',
      birthDate: '1998-09-30',
      gender: 'FEMENINO',
      phone: '+595 982 778 899',
      whatsapp: '+595 982 778 899',
      email: 'camila.fernandez@gmail.com',
      department: 'Central',
      city: 'Luque',
      neighborhood: 'Zárate Isla',
      address: 'Avda. Gral. Aquino c/ Las Residentas',
      emergencyContactName: 'Jorge Fernández (Padre)',
      emergencyContactPhone: '+595 982 444 333',
      bloodType: 'O+',
      allergies: 'Ninguna conocida',
      medicalConditions: 'Ninguna',
      medications: 'Ninguna',
      status: 'ACTIVE',
      createdAt: new Date('2026-03-01T11:15:00.000Z'),
      updatedAt: new Date('2026-03-01T11:15:00.000Z'),
    }
  ];

  const patientBranches = [
    { patientId: pat1Id, branchId: branchAsuId, firstVisitDate: '2026-02-10', lastVisitDate: '2026-09-21' },
    { patientId: pat2Id, branchId: branchAsuId, firstVisitDate: '2026-02-14', lastVisitDate: '2026-09-21' },
    { patientId: pat3Id, branchId: branchSloId, firstVisitDate: '2026-02-20', lastVisitDate: '2026-09-20' },
    { patientId: pat4Id, branchId: branchLuqId, firstVisitDate: '2026-03-01', lastVisitDate: '2026-09-18' },
  ];

  // 7. Citas para hoy y la semana
  const app1Id = '66666666-6666-4666-8666-666666666661';
  const app2Id = '66666666-6666-4666-8666-666666666662';
  const app3Id = '66666666-6666-4666-8666-666666666663';

  const appointments = [
    {
      id: app1Id,
      organizationId: orgId,
      branchId: branchAsuId,
      dentalChairId: chairAsu1,
      patientId: pat1Id,
      odontologistId: userAdminId,
      serviceId: services[6].id, // Control Ortodoncia
      appointmentDate: '2026-09-21',
      startTime: '09:00:00',
      endTime: '09:30:00',
      durationMin: 30,
      status: 'EN_ATENCION',
      reason: 'Ajuste de brackets metálicos superior e inferior y cambio de ligaduras',
      notes: 'Paciente acudió puntual. Sin quejas de dolor.',
      createdBy: userAdminId,
      createdAt: new Date('2026-09-15T10:00:00.000Z'),
      updatedAt: new Date('2026-09-21T09:05:00.000Z'),
    },
    {
      id: app2Id,
      organizationId: orgId,
      branchId: branchAsuId,
      dentalChairId: chairAsu2,
      patientId: pat2Id,
      odontologistId: userAdminId,
      serviceId: services[4].id, // Endodoncia
      appointmentDate: '2026-09-21',
      startTime: '10:00:00',
      endTime: '11:00:00',
      durationMin: 60,
      status: 'EN_SALA',
      reason: 'Segunda sesión de endodoncia en pieza 24 con instrumentación rotatoria',
      notes: 'Confirmado por WhatsApp a las 07:30',
      createdBy: userAdminId,
      createdAt: new Date('2026-09-16T11:00:00.000Z'),
      updatedAt: new Date('2026-09-21T09:50:00.000Z'),
    },
    {
      id: app3Id,
      organizationId: orgId,
      branchId: branchSloId,
      dentalChairId: chairSlo1,
      patientId: pat3Id,
      odontologistId: userAdminId,
      serviceId: services[1].id, // Tartrectomía con Ultrasonido
      appointmentDate: '2026-09-21',
      startTime: '14:30:00',
      endTime: '15:15:00',
      durationMin: 45,
      status: 'CONFIRMADA',
      reason: 'Limpieza dental profunda periódica y fluorización',
      notes: 'Alergia a aspirina recordada en ficha',
      createdBy: userAdminId,
      createdAt: new Date('2026-09-18T14:20:00.000Z'),
      updatedAt: new Date('2026-09-20T17:00:00.000Z'),
    }
  ];

  // 8. Fichas clínicas y Odontogramas
  const cr1Id = '77777777-7777-4777-8777-777777777771';
  const odon1Id = '88888888-8888-4888-8888-888888888881';

  const clinicalRecords = [
    {
      id: cr1Id,
      organizationId: orgId,
      branchId: branchAsuId,
      patientId: pat1Id,
      odontologistId: userAdminId,
      appointmentId: app1Id,
      reasonForConsultation: 'Control mensual ortodóncico regular.',
      diagnosis: 'Maloclusión Clase II División 1 en fase intermedia de alineación y nivelación.',
      treatmentPerformed: 'Cambio de arcos termoactivados NiTi 0.016x0.022. Colocación de elásticos intermaxilares Clase II.',
      prescriptions: 'Ibuprofeno 400mg en caso de molestia masticatoria durante 24hs.',
      recommendations: 'Uso estricto de elásticos 24 horas al día, retirar solo para comidas y cepillado.',
      internalNotes: 'Excelente higiene bucal, sin caries activas detectadas.',
      attachments: [],
      createdAt: new Date('2026-09-21T09:20:00.000Z'),
      updatedAt: new Date('2026-09-21T09:20:00.000Z'),
    }
  ];

  const odontograms = [
    {
      id: odon1Id,
      organizationId: orgId,
      patientId: pat1Id,
      odontologistId: userAdminId,
      clinicalRecordId: cr1Id,
      version: 1,
      odontogramType: 'ADULTO',
      generalObservations: 'Arco dental completo. Apiñamiento anteroinferior resuelto al 80%.',
      createdAt: new Date('2026-02-10T09:30:00.000Z'),
      updatedAt: new Date('2026-09-21T09:25:00.000Z'),
    }
  ];

  const odontogramItems = [
    {
      id: '88888888-8888-4888-8888-888888888801',
      odontogramId: odon1Id,
      toothNumber: 16,
      surface: 'OCLUSAL',
      condition: 'OBTURACION',
      material: 'Resina Compuesta',
      notes: 'Restauración en buen estado, márgenes sellados.',
      colorCode: '#3B82F6',
      createdAt: new Date(),
    },
    {
      id: '88888888-8888-4888-8888-888888888802',
      odontogramId: odon1Id,
      toothNumber: 26,
      surface: 'OCLUSAL',
      condition: 'OBTURACION',
      material: 'Resina Compuesta',
      notes: 'Buen estado clínico.',
      colorCode: '#3B82F6',
      createdAt: new Date(),
    },
    {
      id: '88888888-8888-4888-8888-888888888803',
      odontogramId: odon1Id,
      toothNumber: 18,
      surface: 'GENERAL',
      condition: 'AUSENTE',
      material: null,
      notes: 'Exodoncia realizada previamente.',
      colorCode: '#6B7280',
      createdAt: new Date(),
    },
    {
      id: '88888888-8888-4888-8888-888888888804',
      odontogramId: odon1Id,
      toothNumber: 48,
      surface: 'GENERAL',
      condition: 'CARIES',
      material: null,
      notes: 'Caries en esmalte superficial detectada.',
      colorCode: '#EF4444',
      createdAt: new Date(),
    }
  ];

  // 9. Presupuestos y Tratamientos
  const quote1Id = '99999999-9999-4999-8999-999999999991';
  const treat1Id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

  const quotes = [
    {
      id: quote1Id,
      organizationId: orgId,
      branchId: branchAsuId,
      patientId: pat1Id,
      odontologistId: userAdminId,
      quoteNumber: 'PRE-2026-00142',
      totalAmount: 3360000, // ₲ 3.360.000
      discountAmount: 160000,
      finalAmount: 3200000, // ₲ 3.200.000
      status: 'APROBADO',
      validUntil: '2026-10-31',
      notes: 'Plan integral ortodóncico con cuotas mensuales fijas en Guaraníes.',
      createdAt: new Date('2026-02-10T10:00:00.000Z'),
      updatedAt: new Date('2026-02-10T10:30:00.000Z'),
    }
  ];

  const quoteItems = [
    {
      id: '99999999-9999-4999-8999-999999999901',
      quoteId: quote1Id,
      serviceId: services[6].id, // Brackets
      toothNumber: null,
      description: 'Instalación aparatología ortodóncica fija metálica superior e inferior',
      quantity: 1,
      unitPrice: 1200000,
      subtotal: 1200000,
    },
    {
      id: '99999999-9999-4999-8999-999999999902',
      quoteId: quote1Id,
      serviceId: services[7].id, // Control mensual
      toothNumber: null,
      description: 'Paquete de 12 controles mensuales de ortodoncia',
      quantity: 12,
      unitPrice: 180000,
      subtotal: 2160000,
    }
  ];

  const treatments = [
    {
      id: treat1Id,
      organizationId: orgId,
      branchId: branchAsuId,
      patientId: pat1Id,
      quoteId: quote1Id,
      title: 'Tratamiento Integral de Ortodoncia Fija',
      totalAmount: 3200000,
      paidAmount: 1560000,
      balanceDue: 1640000,
      status: 'EN_PROGRESO',
      startDate: '2026-02-15',
      completedDate: null,
      createdAt: new Date('2026-02-10T10:30:00.000Z'),
      updatedAt: new Date('2026-09-21T09:30:00.000Z'),
    }
  ];

  // 10. Caja Chica y Movimientos Financieros
  const cashReg1Id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  const cashMov1Id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  const cashMov2Id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';

  const cashRegisters = [
    {
      id: cashReg1Id,
      organizationId: orgId,
      branchId: branchAsuId,
      openedBy: userAdminId,
      closedBy: null,
      openingAmount: 500000, // ₲ 500.000 de fondo de cambio inicial
      closingAmountExpected: null,
      closingAmountReal: null,
      differenceAmount: null,
      status: 'ABIERTA',
      openedAt: new Date('2026-09-21T07:30:00.000Z'),
      closedAt: null,
      observations: 'Caja mañana abierta con fondo de cambio en billetes de 20mil y 50mil.',
    }
  ];

  const cashMovements = [
    {
      id: cashMov1Id,
      cashRegisterId: cashReg1Id,
      movementType: 'INGRESO',
      amount: 180000, // ₲ 180.000
      paymentMethod: 'TRANSFERENCIA_SIPAP',
      concept: 'Pago Control Ortodoncia - Gustavo Caballero',
      referenceNumber: 'SIPAP-ITAU-9483021',
      performedBy: userAdminId,
      createdAt: new Date('2026-09-21T09:30:00.000Z'),
    },
    {
      id: cashMov2Id,
      cashRegisterId: cashReg1Id,
      movementType: 'INGRESO',
      amount: 550000, // ₲ 550.000
      paymentMethod: 'QR_BANCARIO',
      concept: 'Pago Tratamiento Endodóntico - Lourdes Vera',
      referenceNumber: 'BANCARD-QR-558291',
      performedBy: userAdminId,
      createdAt: new Date('2026-09-21T09:45:00.000Z'),
    }
  ];

  const payments = [
    {
      id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      organizationId: orgId,
      branchId: branchAsuId,
      patientId: pat1Id,
      treatmentId: treat1Id,
      appointmentId: app1Id,
      cashMovementId: cashMov1Id,
      receiptNumber: 'REC-001-001-0004120',
      invoiceNumber: '001-001-0002890',
      amount: 180000,
      paymentMethod: 'TRANSFERENCIA_SIPAP',
      status: 'COMPLETADO',
      notes: 'Transferencia verificada en cuenta Banco Itaú Paraguay',
      receivedBy: userAdminId,
      createdAt: new Date('2026-09-21T09:30:00.000Z'),
    }
  ];

  // 11. Auditoría
  const auditLogs = [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      organizationId: orgId,
      branchId: branchAsuId,
      userId: userAdminId,
      action: 'OPEN_CASH_REGISTER',
      entity: 'CASH_REGISTER',
      entityId: cashReg1Id,
      ipAddress: '190.52.144.12',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0',
      oldValues: null,
      newValues: { status: 'ABIERTA', openingAmount: 500000 },
      description: 'Apertura de caja diaria con fondo de ₲ 500.000',
      createdAt: new Date('2026-09-21T07:30:00.000Z'),
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
      organizationId: orgId,
      branchId: branchAsuId,
      userId: userAdminId,
      action: 'CHECK_IN_PATIENT',
      entity: 'APPOINTMENT',
      entityId: app1Id,
      ipAddress: '190.52.144.12',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0',
      oldValues: { status: 'PENDIENTE' },
      newValues: { status: 'EN_ATENCION' },
      description: 'Recepción del paciente Gustavo Caballero en sala y pase a sillón dental',
      createdAt: new Date('2026-09-21T09:05:00.000Z'),
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
      organizationId: orgId,
      branchId: branchAsuId,
      userId: userAdminId,
      action: 'READ_SENSITIVE',
      entity: 'CLINICAL_RECORD',
      entityId: cr1Id,
      ipAddress: '190.52.144.18',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      oldValues: null,
      newValues: null,
      description: 'Acceso a historia clínica sensible y anamnesis del paciente Gustavo Caballero por Lucas Eliezer Arrua Almada',
      createdAt: new Date('2026-09-21T09:12:00.000Z'),
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4',
      organizationId: orgId,
      branchId: branchAsuId,
      userId: userAdminId,
      action: 'UPDATE',
      entity: 'ODONTOGRAM',
      entityId: odon1Id,
      ipAddress: '190.52.144.18',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      oldValues: { tooth48: 'SANO' },
      newValues: { tooth48: 'CARIES' },
      description: 'Actualización de hallazgo patológico en pieza dental 48 (Caries superficial en esmalte)',
      createdAt: new Date('2026-09-21T09:25:00.000Z'),
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
      organizationId: orgId,
      branchId: branchAsuId,
      userId: userAdminId,
      action: 'CREATE',
      entity: 'PAYMENT',
      entityId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Cash Engine',
      oldValues: null,
      newValues: { amount: 180000, paymentMethod: 'TRANSFERENCIA_SIPAP', receiptNumber: 'REC-001-001-0004120' },
      description: 'Cobro de consulta/control mensual por ₲ 180.000 vía SIPAP Banco Itaú',
      createdAt: new Date('2026-09-21T09:30:00.000Z'),
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6',
      organizationId: orgId,
      branchId: branchSloId,
      userId: userAdminId,
      action: 'READ_SENSITIVE',
      entity: 'CLINICAL_RECORD',
      entityId: pat2Id,
      ipAddress: '181.124.89.44',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/130.0',
      oldValues: null,
      newValues: null,
      description: 'Consulta de antecedentes alérgicos a Penicilina en ficha de paciente Lourdes Vera',
      createdAt: new Date('2026-09-21T09:35:00.000Z'),
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee7',
      organizationId: orgId,
      branchId: branchAsuId,
      userId: userAdminId,
      action: 'CREATE',
      entity: 'QUOTE',
      entityId: quote1Id,
      ipAddress: '190.52.144.18',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      oldValues: null,
      newValues: { total: 3200000, itemsCount: 2 },
      description: 'Emisión de presupuesto ortodóncico PRE-2026-001 por ₲ 3.200.000',
      createdAt: new Date('2026-09-21T09:40:00.000Z'),
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee8',
      organizationId: orgId,
      branchId: null,
      userId: userAdminId,
      action: 'LOGIN',
      entity: 'USER_SESSION',
      entityId: userAdminId,
      ipAddress: '190.52.144.12',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      oldValues: null,
      newValues: { method: 'PASSWORD_HASH_VERIFIED' },
      description: 'Inicio de sesión exitoso con credenciales de Super Administrador',
      createdAt: new Date('2026-09-21T07:15:00.000Z'),
    }
  ];

  return {
    organization,
    branches,
    branchSettings,
    dentalChairs,
    roles,
    users,
    userBranches,
    services,
    branchServices,
    patients,
    patientBranches,
    appointments,
    clinicalRecords,
    odontograms,
    odontogramItems,
    quotes,
    quoteItems,
    treatments,
    cashRegisters,
    cashMovements,
    payments,
    auditLogs,
  };
}
