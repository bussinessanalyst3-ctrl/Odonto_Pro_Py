import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { dbStore } from '../src/db/inMemoryStore.ts';
import { getTodayAsuncionISO } from '../src/config/appBrand.ts';

async function apiRequest(
  baseUrl: string,
  endpoint: string,
  opts: { method?: string; body?: string; headers?: Record<string, string>; cookie?: string } = {}
) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) {
    headers['Cookie'] = opts.cookie;
  }
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json
  }
  const setCookie = res.headers.get('set-cookie');
  const sidMatch = setCookie?.match(/odontopro_sid=([^;]+)/);
  return {
    status: res.status,
    json,
    text,
    sidCookie: sidMatch ? `odontopro_sid=${sidMatch[1]}` : '',
  };
}

function resetStoreAsSuperAdmin() {
  const snap = dbStore.getSnapshot();
  const sa = snap.users.find((u) => u.roleId === 'SUPER_ADMIN') || snap.users[0];
  dbStore.resetToSeed({
    userId: sa.id,
    role: sa.roleId,
    organizationId: sa.organizationId,
  });
}

test('Etapa 3 — Pacientes en Store: persistencia completa sin datos ficticios, C.I. único e inmutabilidad', () => {
  resetStoreAsSuperAdmin();
  const snap = dbStore.getSnapshot();
  const branch = snap.branches[0];
  const actorUserId = snap.users[0].id;

  const prevPatientsRef = dbStore.getSnapshot().patients;

  // 1) Crear paciente dejando campos opcionales vacíos -> NO inventa fecha 1995 ni correo @gmail.com ni sangre O+
  const patMinimal = dbStore.addPatient({
    firstName: 'Marta',
    lastName: 'Benítez',
    documentType: 'CI',
    documentNumber: '4.555.111',
    phone: '+595981111222',
    primaryBranchId: branch.id,
    modality: 'PARTICULAR',
    actorUserId,
  });

  assert.notEqual(
    dbStore.getSnapshot().patients,
    prevPatientsRef,
    'patients debe reemplazarse de forma inmutable para disparar reactividad'
  );
  assert.equal(patMinimal.birthDate, null);
  assert.equal(patMinimal.email, null);
  assert.equal(patMinimal.address, null);
  assert.equal(patMinimal.bloodType, null);
  assert.equal(patMinimal.status, 'ACTIVE');

  // 2) Crear paciente con todos los campos clínicos y de contacto -> todos deben conservarse intactos
  const patFull = dbStore.addPatient({
    firstName: 'Jorge',
    lastName: 'Cardozo',
    documentType: 'CI',
    documentNumber: '4999888',
    birthDate: '1988-11-23',
    gender: 'M',
    phone: '+595971222333',
    whatsapp: '+595971222333',
    email: 'jorge.cardozo@clinica.py',
    city: 'Luque',
    neighborhood: 'Centro',
    address: 'Av. General Aquino 450',
    emergencyContactName: 'Elena Cardozo',
    emergencyContactPhone: '+595981999888',
    bloodType: 'A+',
    allergies: 'Penicilina',
    medicalConditions: 'Hipertensión controlada',
    medications: 'Losartán 50mg',
    primaryBranchId: branch.id,
    modality: 'PARTICULAR',
    actorUserId,
  });

  assert.equal(patFull.birthDate, '1988-11-23');
  assert.equal(patFull.email, 'jorge.cardozo@clinica.py');
  assert.equal(patFull.address, 'Av. General Aquino 450');
  assert.equal(patFull.emergencyContactName, 'Elena Cardozo');
  assert.equal(patFull.bloodType, 'A+');
  assert.equal(patFull.medicalConditions, 'Hipertensión controlada');
  assert.equal(patFull.medications, 'Losartán 50mg');

  // 3) Rechazar C.I. duplicada aunque varíe en puntos o espacios (4.555.111 vs 4555111)
  assert.throws(
    () =>
      dbStore.addPatient({
        firstName: 'Duplicado',
        lastName: 'Error',
        documentType: 'CI',
        documentNumber: '4555111',
        phone: '+595981000000',
        primaryBranchId: branch.id,
        modality: 'PARTICULAR',
        actorUserId,
      }),
    /ya existe un paciente/i
  );

  // 4) Rechazar duplicado al editar C.I. de otro paciente
  assert.throws(
    () =>
      dbStore.updatePatient(
        patFull.id,
        { documentNumber: '4 555 111' },
        actorUserId
      ),
    /ya existe otro paciente/i
  );

  // 5) Toggle status funciona correctamente con 'ACTIVE' y reemplaza la referencia del array
  const refBeforeToggle = dbStore.getSnapshot().patients;
  const toggledOff = dbStore.togglePatientStatus(patMinimal.id);
  assert.equal(toggledOff?.status, 'INACTIVE');
  assert.notEqual(dbStore.getSnapshot().patients, refBeforeToggle);

  const toggledOn = dbStore.togglePatientStatus(patMinimal.id);
  assert.equal(toggledOn?.status, 'ACTIVE');
});

test('Etapa 3 — Agenda, Historia Clínica con fecha pasada y Odontograma en Store', () => {
  resetStoreAsSuperAdmin();
  const snap = dbStore.getSnapshot();
  const branch = snap.branches[0];
  const service = snap.services[0];
  const actorUserId = snap.users[0].id;
  const chair = snap.dentalChairs.find((c) => c.branchId === branch.id)!;

  const pat = dbStore.addPatient({
    firstName: 'Sofía',
    lastName: 'Rojas',
    documentType: 'CI',
    documentNumber: '5222333',
    phone: '+595982444555',
    primaryBranchId: branch.id,
    modality: 'PARTICULAR',
    actorUserId,
  });

  // 1) Cita histórica (2024-06-15) con un solo usuario (Super Admin) -> createdBy nunca undefined
  const prevApptsRef = dbStore.getSnapshot().appointments;
  const histAppt = dbStore.addAppointment({
    branchId: branch.id,
    patientId: pat.id,
    odontologistId: actorUserId,
    serviceId: service.id,
    dentalChairId: chair.id,
    appointmentDate: '2024-06-15',
    startTime: '09:00',
    endTime: '09:45',
    durationMin: 45,
    reason: 'Control histórico 2024',
  });
  assert.notEqual(dbStore.getSnapshot().appointments, prevApptsRef);
  assert.equal(histAppt.appointmentDate, '2024-06-15');
  assert.equal(histAppt.createdBy, actorUserId);

  // 2) Evolución clínica histórica (2024-06-15) preserva fecha histórica y reemplaza clinicalRecords inmutablemente
  const prevRecordsRef = dbStore.getSnapshot().clinicalRecords;
  const histRecord = dbStore.addClinicalRecord({
    patientId: pat.id,
    branchId: branch.id,
    odontologistId: actorUserId,
    appointmentId: histAppt.id,
    recordDate: '2024-06-15',
    reasonForConsultation: 'Sensibilidad molar inferior',
    diagnosis: 'Caries dentinaria pieza 46',
    treatmentPerformed: 'Restauración con resina compuesta',
  });
  assert.notEqual(dbStore.getSnapshot().clinicalRecords, prevRecordsRef);
  const createdAtIso = new Date(histRecord.createdAt).toISOString();
  assert.ok(
    createdAtIso.startsWith('2024-06-15'),
    `createdAt debe conservar la fecha histórica 2024-06-15 (obtenido: ${createdAtIso})`
  );

  // 3) Odontograma: rechazar paciente vacío, crear v1, marcar hallazgo, clonar v2 sin mutar v1 y limpiar en v2
  assert.throws(
    () =>
      dbStore.createOdontogramVersion({
        patientId: '',
        odontologistId: actorUserId,
        odontogramType: 'ADULTO',
      }),
    /paciente/i
  );

  const v1 = dbStore.createOdontogramVersion({
    patientId: pat.id,
    odontologistId: actorUserId,
    odontogramType: 'ADULTO',
    generalObservations: 'Odontograma inicial 2024',
  });
  assert.equal(v1.version, 1);

  const prevItemsRef = dbStore.getSnapshot().odontogramItems;
  dbStore.updateToothCondition({
    odontogramId: v1.id,
    toothNumber: 46,
    surface: 'OCLUSAL',
    condition: 'CARIES',
    notes: 'Caries profunda oclusal',
  });
  assert.notEqual(dbStore.getSnapshot().odontogramItems, prevItemsRef);
  const v1Items = dbStore.getOdontogramItems(v1.id);
  assert.equal(v1Items.length, 1);

  const v2 = dbStore.createOdontogramVersion({
    patientId: pat.id,
    odontologistId: actorUserId,
    odontogramType: 'ADULTO',
    generalObservations: 'Control post restauración',
    items: v1Items.map((it) => ({
      toothNumber: it.toothNumber,
      surface: it.surface,
      condition: it.condition,
      material: it.material || undefined,
      notes: it.notes,
      colorCode: it.colorCode,
    })),
  });
  assert.equal(v2.version, 2);
  assert.equal(dbStore.getOdontogramItems(v2.id).length, 1, 'v2 debe heredar hallazgos clonados de v1');

  // Marcar pieza 46 como SANO en v2 elimina el hallazgo en v2 sin tocar v1 (historia preservada)
  dbStore.updateToothCondition({
    odontogramId: v2.id,
    toothNumber: 46,
    surface: 'OCLUSAL',
    condition: 'SANO',
  });
  assert.equal(dbStore.getOdontogramItems(v2.id).length, 0);
  assert.equal(dbStore.getOdontogramItems(v1.id).length, 1, 'v1 histórico no debe alterarse al editar v2');
});

test('Etapa 3 E2E — API autoritativa de Pacientes, Agenda (sillón libre + histórico), Historia Clínica y Odontograma', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-stage3-clin-'));
  process.env.DATA_DIR = tmpDir;
  process.env.NODE_ENV = 'production';

  const { createConfiguredApp } = await import('../server.ts');
  const { getServerDbState } = await import('../server/stateStore.ts');
  const { createPbkdf2Hash } = await import('../server/crypto.ts');

  const app = await createConfiguredApp({ skipFrontend: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const state = getServerDbState();
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN')!;
    const hash = createPbkdf2Hash('Stage3Test#2026');
    superAdmin.passwordHash = hash.hash;
    superAdmin.passwordSalt = hash.salt;
    superAdmin.passwordIterations = hash.iterations;

    // Agregar un segundo odontólogo y asegurar 2 sillones activos en la sucursal principal
    const branch = state.data.branches[0];
    const secondDoctorId = 'usr-stage3-doc-2';
    state.data.users.push({
      id: secondDoctorId,
      organizationId: state.data.organization.id,
      firstName: 'Camila',
      lastName: 'Duarte',
      fullName: 'Dra. Camila Duarte',
      email: 'camila.duarte@odontopro.test',
      username: 'camila.duarte',
      roleId: 'ODONTOLOGO',
      primaryBranchId: branch.id,
      branchIds: [branch.id],
      status: 'ACTIVE',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    const activeBranchChairs = state.data.dentalChairs.filter(
      (c: any) => c.organizationId === state.data.organization.id && c.branchId === branch.id && c.status !== 'INACTIVE'
    );
    if (activeBranchChairs.length < 2) {
      state.data.dentalChairs.push({
        id: 'chair-stage3-extra',
        organizationId: state.data.organization.id,
        branchId: branch.id,
        name: 'Sillón 2 (Test)',
        code: 'S2-TEST',
        status: 'ACTIVE',
      });
    }

    const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: superAdmin.username || superAdmin.email,
        password: 'Stage3Test#2026',
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.sidCookie;

    // 1) POST /api/patients con todos los campos (incluyendo sangre, antecedentes, contacto emergencia)
    const createPatRes = await apiRequest(baseUrl, '/api/patients', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        firstName: 'Roberto',
        lastName: 'Galeano',
        documentType: 'CI',
        documentNumber: '3.888.999',
        birthDate: '1984-03-12',
        gender: 'M',
        phone: '+595981333444',
        email: '',
        city: 'San Lorenzo',
        address: 'Ruta Mcal. Estigarribia Km 10',
        emergencyContactName: 'Laura Galeano',
        emergencyContactPhone: '+595981777666',
        bloodType: 'B+',
        allergies: 'Látex',
        medicalConditions: 'Asma leve',
        medications: 'Salbutamol',
        primaryBranchId: branch.id,
        modality: 'PARTICULAR',
      }),
    });
    assert.equal(createPatRes.status, 201);
    const pat1 = createPatRes.json.patient;
    assert.equal(pat1.birthDate, '1984-03-12');
    assert.equal(pat1.email, null, 'Email vacío debe guardarse como null, no inventar correo');
    assert.equal(pat1.bloodType, 'B+');
    assert.equal(pat1.medicalConditions, 'Asma leve');
    assert.equal(pat1.medications, 'Salbutamol');
    assert.equal(pat1.emergencyContactName, 'Laura Galeano');

    // 2) POST /api/patients con C.I. duplicada normalizada (3888999 vs 3.888.999) -> 409
    const dupPatRes = await apiRequest(baseUrl, '/api/patients', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        firstName: 'Otro',
        lastName: 'Paciente',
        documentType: 'CI',
        documentNumber: '3888999',
        phone: '+595981000999',
        primaryBranchId: branch.id,
        modality: 'PARTICULAR',
      }),
    });
    assert.equal(dupPatRes.status, 409);
    assert.equal(dupPatRes.json.code, 'DUPLICATE_PATIENT_DOCUMENT');

    // Crear un segundo paciente válido para probar colisión de edición y citas simultáneas
    const createPat2Res = await apiRequest(baseUrl, '/api/patients', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        firstName: 'Andrea',
        lastName: 'Villalba',
        documentType: 'CI',
        documentNumber: '7111222',
        phone: '+595983111222',
        primaryBranchId: branch.id,
        modality: 'PARTICULAR',
      }),
    });
    assert.equal(createPat2Res.status, 201);
    const pat2 = createPat2Res.json.patient;
    assert.equal(pat2.birthDate, null);

    // 3) PUT /api/patients/:id rechaza C.I. duplicada de otro paciente (409)
    const dupUpdateRes = await apiRequest(baseUrl, `/api/patients/${pat2.id}`, {
      method: 'PUT',
      cookie,
      body: JSON.stringify({ documentNumber: '3.888.999' }),
    });
    assert.equal(dupUpdateRes.status, 409);

    // 4) PUT /api/patients/:id actualiza campos y genera auditoría UPDATE
    const updatePatRes = await apiRequest(baseUrl, `/api/patients/${pat1.id}`, {
      method: 'PUT',
      cookie,
      body: JSON.stringify({
        city: 'Fernando de la Mora',
        bloodType: 'O-',
      }),
    });
    assert.equal(updatePatRes.status, 200);
    assert.equal(updatePatRes.json.patient.city, 'Fernando de la Mora');
    assert.equal(updatePatRes.json.patient.bloodType, 'O-');
    assert.ok(
      Array.isArray(updatePatRes.json.auditLogs) &&
        updatePatRes.json.auditLogs.some((l: any) => l.entity === 'PATIENT' && l.action === 'UPDATE'),
      'La edición de paciente debe registrar auditoría UPDATE'
    );

    // 5) POST /api/appointments rechaza horario que cruza medianoche (23:45 + 30 min)
    const overflowApptRes = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        branchId: branch.id,
        patientId: pat1.id,
        odontologistId: superAdmin.id,
        appointmentDate: '2026-07-10',
        startTime: '23:45',
        durationMin: 30,
        reason: 'Prueba medianoche',
      }),
    });
    assert.equal(overflowApptRes.status, 400);

    // 6) Cita automática #1 (sin dentalChairId) ocupa primer sillón libre; cita simultánea #2 con OTRO doctor
    //    y sin dentalChairId debe elegir automáticamente el SEGUNDO sillón libre en vez de dar falso conflicto 409!
    const appt1Res = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        branchId: branch.id,
        patientId: pat1.id,
        odontologistId: superAdmin.id,
        appointmentDate: '2024-08-20',
        startTime: '10:00',
        durationMin: 30,
        reason: 'Consulta histórica agosto 2024',
      }),
    });
    assert.equal(appt1Res.status, 201);
    const appt1 = appt1Res.json.appointment;
    assert.ok(appt1.dentalChairId);

    const appt2Res = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        branchId: branch.id,
        patientId: pat2.id,
        odontologistId: secondDoctorId,
        appointmentDate: '2024-08-20',
        startTime: '10:00',
        durationMin: 30,
        reason: 'Consulta simultánea en segundo sillón',
      }),
    });
    assert.equal(
      appt2Res.status,
      201,
      'Con un segundo sillón libre y otro doctor, la asignación automática debe elegir el sillón libre sin falso 409'
    );
    assert.notEqual(appt2Res.json.appointment.dentalChairId, appt1.dentalChairId);

    // 7) Conflicto real de doctor a la misma hora sí debe devolver 409
    const conflictDocRes = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        branchId: branch.id,
        patientId: pat2.id,
        odontologistId: superAdmin.id,
        appointmentDate: '2024-08-20',
        startTime: '10:15',
        durationMin: 30,
        reason: 'Solapamiento del mismo doctor',
      }),
    });
    assert.equal(conflictDocRes.status, 409);

    // 8) Verificar que firstVisitDate en patientBranches refleja la fecha histórica 2024-08-20 y no sobreescribe lastVisitDate posterior
    const pbAfterHist = state.data.patientBranches.find(
      (pb: any) => pb.patientId === pat1.id && pb.branchId === branch.id
    );
    assert.ok(pbAfterHist);
    assert.equal(pbAfterHist.firstVisitDate, '2024-08-20');
    assert.equal(pbAfterHist.lastVisitDate, getTodayAsuncionISO());

    // 9) POST /api/clinical-records con fecha histórica 2024-08-20 vinculada a appt1:
    //    guarda fecha histórica y finaliza automáticamente la cita vinculada
    const clinRes = await apiRequest(baseUrl, '/api/clinical-records', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        patientId: pat1.id,
        branchId: branch.id,
        appointmentId: appt1.id,
        recordDate: '2024-08-20',
        reasonForConsultation: 'Control periódico histórico',
        diagnosis: 'Gingivitis leve',
        treatmentPerformed: 'Profilaxis supragingival',
      }),
    });
    assert.equal(clinRes.status, 201);
    assert.ok(clinRes.json.clinicalRecord.createdAt.startsWith('2024-08-20'));
    assert.ok(clinRes.json.appointment, 'Debe devolver la cita vinculada actualizada');
    assert.equal(clinRes.json.appointment.status, 'FINALIZADA');

    // 10) Persistencia de Odontograma vía /api/db/delta (v1 + diente marcado)
    const odontoId = 'odonto-stage3-e2e-v1';
    const itemId = 'oi-stage3-e2e-1';
    const deltaRes = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        upserts: {
          odontograms: [
            {
              id: odontoId,
              organizationId: state.data.organization.id,
              patientId: pat1.id,
              branchId: branch.id,
              odontologistId: superAdmin.id,
              odontogramType: 'ADULTO',
              version: 1,
              generalObservations: 'Odontograma E2E Stage 3',
              createdAt: '2024-08-20T16:00:00.000Z',
              updatedAt: '2024-08-20T16:00:00.000Z',
            },
          ],
          odontogramItems: [
            {
              id: itemId,
              odontogramId: odontoId,
              toothNumber: 16,
              surface: 'MESIAL',
              condition: 'CARIES',
              notes: 'Hallazgo E2E',
              colorCode: '#EF4444',
              createdAt: '2024-08-20T16:05:00.000Z',
            },
          ],
        },
        deletes: {},
      }),
    });
    assert.equal(deltaRes.status, 200);
    assert.ok(state.data.odontograms.some((o: any) => o.id === odontoId));
    assert.ok(state.data.odontogramItems.some((i: any) => i.id === itemId && i.toothNumber === 16));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
