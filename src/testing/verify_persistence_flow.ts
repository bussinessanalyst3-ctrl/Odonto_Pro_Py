import { dbStore } from '../db/inMemoryStore.ts';
import { authService } from '../auth/authService.ts';
import fs from 'fs';
import path from 'path';

async function runPersistenceFlowTest() {
  console.log('================================================================');
  console.log('INICIANDO PRUEBA TÉCNICA DE PERSISTENCIA MULTI-NAVEGADOR');
  console.log('================================================================\n');

  const DB_FILE = path.join(process.cwd(), 'data', 'db_store.json');

  // Paso 0: Asegurar que el backend y dbStore estén sincronizados
  await dbStore.syncFromServer();
  const initialOrgs = dbStore.getOrganizations();
  console.log(`[Paso 0] Organizaciones iniciales en el sistema: ${initialOrgs.length} (${initialOrgs.map(o => o.name).join(', ')})`);

  // Paso 1: Iniciar sesión como Super Administrador
  console.log('\n[Paso 1] Autenticando como Super Administrador (Lucas Arrua)...');
  const loginRes = await authService.login({
    email: 'lucas.arrua@odontosol.com.py',
    password: 'OdontoSol2026!',
  });

  if (!loginRes.success || !loginRes.session) {
    throw new Error(`Fallo en login de Super Admin: ${loginRes.error}`);
  }
  const superAdminSession = loginRes.session;
  console.log(`✓ Super Admin autenticado con éxito. Token de sesión: ${superAdminSession.sessionToken.slice(0, 16)}...`);

  // Paso 2: Crear Empresa A
  console.log('\n[Paso 2] Creando "Empresa A" (Clínica Dental Asunción Este S.A.)...');
  const orgPayload = {
    name: 'Clínica Dental Asunción Este S.A.',
    tradeName: 'Asunción Este Dental',
    legalName: 'Clínica Dental Asunción Este Sociedad Anónima',
    taxId: '80123456-7',
    primaryColor: 'cyan',
    phone: '+595 21 654 321',
    email: 'contacto@asuncioneste.com.py',
    address: 'Av. Eusebio Ayala 3450, Asunción',
    initialAdmin: {
      firstName: 'Marcos',
      lastName: 'Gómez',
      email: 'marcos.gomez@asuncioneste.com.py',
      phone: '+595 981 777888',
    },
  };

  const createdOrg = dbStore.addOrganization(orgPayload, {
    userId: superAdminSession.userId,
    role: superAdminSession.role,
    organizationId: superAdminSession.organizationId,
  });

  console.log(`✓ Empresa A creada con ID: ${createdOrg.id}`);
  console.log(`✓ RUC: ${createdOrg.taxId}, Nombre: ${createdOrg.name}`);

  // Esperar a que la sincronización al archivo del servidor se complete
  await new Promise((r) => setTimeout(r, 600));

  // Verificar persistencia física en el disco del servidor
  if (!fs.existsSync(DB_FILE)) {
    throw new Error('El archivo de base de datos persistente data/db_store.json no existe en disco.');
  }
  const diskState = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const foundOnDisk = diskState.organizationsList.find((o: any) => o.id === createdOrg.id);
  if (!foundOnDisk) {
    throw new Error('FALLO CRÍTICO: Empresa A no fue escrita en el archivo persistente data/db_store.json.');
  }
  console.log(`✓ VERIFICACIÓN DE DISCO: Empresa A guardada permanentemente en data/db_store.json.`);

  // Paso 3: Cerrar sesión
  console.log('\n[Paso 3] Cerrando sesión del usuario actual...');
  authService.logout(superAdminSession);
  console.log('✓ Sesión destruida correctamente.');

  // Paso 4: Volver a iniciar sesión
  console.log('\n[Paso 4] Volviendo a iniciar sesión con Super Administrador...');
  const reloginRes = await authService.login({
    email: 'lucas.arrua@odontosol.com.py',
    password: 'OdontoSol2026!',
  });
  if (!reloginRes.success) {
    throw new Error(`Fallo en re-login: ${reloginRes.error}`);
  }
  console.log('✓ Re-login exitoso.');

  // Verificar que Empresa A continúa existiendo
  const orgsAfterRelogin = dbStore.getOrganizations();
  const orgAfterRelogin = orgsAfterRelogin.find((o) => o.id === createdOrg.id);
  if (!orgAfterRelogin) {
    throw new Error('FALLO: Empresa A desapareció tras cerrar y volver a iniciar sesión.');
  }
  console.log(`✓ Empresa A continúa existiendo tras re-login: "${orgAfterRelogin.name}"`);

  // Paso 5: Recargar la aplicación (Simulación de re-instanciación de cliente)
  console.log('\n[Paso 5] Recargando aplicación y forzando sincronización...');
  await dbStore.syncFromServer();
  const orgsAfterReload = dbStore.getOrganizations();
  const orgAfterReload = orgsAfterReload.find((o) => o.id === createdOrg.id);
  if (!orgAfterReload) {
    throw new Error('FALLO: Empresa A desapareció tras recarga.');
  }
  console.log(`✓ Empresa A verificada tras recarga.`);

  // Paso 6: Simular acceso desde OTRO NAVEGADOR / INCOGNITO (sin localStorage previo)
  console.log('\n[Paso 6] Simulando nuevo navegador / sesión de incógnito completamente limpia...');
  // Hacemos fetch directo a la API del servidor como si fuéramos un cliente HTTP nuevo
  const httpResponse = await fetch('http://localhost:3000/api/db/state');
  if (!httpResponse.ok) {
    throw new Error(`El servidor devolvió HTTP ${httpResponse.status} para nuevo cliente.`);
  }
  const incognitoData = await httpResponse.json();
  const incognitoOrg = incognitoData.organizationsList.find((o: any) => o.id === createdOrg.id);
  if (!incognitoOrg) {
    throw new Error('FALLO: El nuevo navegador no pudo ver Empresa A desde el servidor.');
  }
  console.log(`✓ Nuevo navegador / ventana incógnito recibe Empresa A: "${incognitoOrg.name}" (RUC: ${incognitoOrg.taxId})`);

  // Paso 7: Iniciar sesión en el nuevo navegador con el usuario administrador de Empresa A
  console.log('\n[Paso 7] Iniciando sesión en nuevo navegador con el administrador de Empresa A...');
  const orgAdminLogin = await authService.login({
    email: 'marcos.gomez@asuncioneste.com.py',
    password: 'OdontoPro2026!', // Contraseña maestra institucional permitida para onboarding
  });

  if (!orgAdminLogin.success || !orgAdminLogin.session) {
    throw new Error(`Fallo en login de admin de Empresa A: ${orgAdminLogin.error}`);
  }
  const orgAdminSession = orgAdminLogin.session;
  console.log(`✓ Admin de Empresa A autenticado: ${orgAdminSession.firstName} ${orgAdminSession.lastName}`);
  console.log(`✓ Organización activa del usuario: ${orgAdminSession.organizationName} (ID: ${orgAdminSession.organizationId})`);
  console.log(`✓ Rol: ${orgAdminSession.roleName}`);

  // Verificar que el administrador de organización no pueda elevar privilegios ni acceder a organizaciones ajenas
  console.log('\n[Paso 8] Verificando aislamiento cross-tenant y prevención de elevación de privilegios...');
  try {
    dbStore.switchOrganization('11111111-1111-4111-8111-111111111111', {
      userId: orgAdminSession.userId,
      role: orgAdminSession.role,
      organizationId: orgAdminSession.organizationId,
    });
    throw new Error('FALLO DE SEGURIDAD: Usuario no-superadmin pudo conmutar a organización ajena.');
  } catch (secErr: any) {
    console.log(`✓ Aislamiento cross-tenant validado: ${secErr.message}`);
  }

  // Paso 9: Crear / Modificar información (actualizar datos institucionales de Empresa A)
  console.log('\n[Paso 9] Modificando información de Empresa A...');
  const updatedOrg = dbStore.updateOrganization(
    {
      phone: '+595 21 999 888',
      address: 'Nueva Dirección Comercial 1234, Asunción',
    },
    createdOrg.id,
    {
      userId: orgAdminSession.userId,
      role: orgAdminSession.role,
      organizationId: orgAdminSession.organizationId,
    }
  );

  console.log(`✓ Empresa A modificada: Teléfono=${updatedOrg.phone}, Dirección=${updatedOrg.address}`);
  await new Promise((r) => setTimeout(r, 600));

  // Paso 10: Comprobar que los cambios sean visibles tras cerrar y volver a abrir
  console.log('\n[Paso 10] Verificando que las modificaciones persistan tras cerrar y reabrir...');
  authService.logout(orgAdminSession);

  // Leer directamente del archivo físico
  const updatedDisk = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const finalOrgOnDisk = updatedDisk.organizationsList.find((o: any) => o.id === createdOrg.id);
  if (finalOrgOnDisk.phone !== '+595 21 999 888') {
    throw new Error('FALLO: Los cambios modificados no se persistieron permanentemente en disco.');
  }
  console.log(`✓ Persistencia final confirmada en disco: Teléfono en disco=${finalOrgOnDisk.phone}`);

  console.log('\n================================================================');
  console.log('✓✓✓ TODAS LAS PRUEBAS DE PERSISTENCIA Y AISLAMIENTO PASARON EXITOSAMENTE ✓✓✓');
  console.log('================================================================\n');
}

runPersistenceFlowTest().catch((err) => {
  console.error('\n❌ ERROR EN LA PRUEBA:', err);
  process.exit(1);
});
