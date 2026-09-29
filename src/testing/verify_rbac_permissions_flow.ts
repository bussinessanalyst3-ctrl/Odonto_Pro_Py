import { dbStore } from '../db/inMemoryStore.ts';
import { authService } from '../auth/authService.ts';
import {
  hasPermission,
  canManageRole,
  isSuperAdminRole,
  validateBackendAuthorization,
  getUserEffectivePermissions,
  REGULATORY_RESTRICTIONS_CATALOG,
} from '../security/rbacHierarchy.ts';

async function runRbacPermissionsTest() {
  console.log('================================================================');
  console.log('INICIANDO AUDITORÍA & PRUEBAS DE ROLES, PERMISOS Y RESTRICCIONES');
  console.log('================================================================\n');

  // Asegurar sincronización inicial
  await dbStore.syncFromServer();
  const snapshot = dbStore.getSnapshot();

  // -------------------------------------------------------------------------
  // TEST 1: Jerarquía de Roles y Protección del Super Administrador
  // -------------------------------------------------------------------------
  console.log('[Test 1] Evaluando Jerarquía RBAC y Protección de SUPER_ADMIN...');

  // Super Admin puede administrar todos los roles
  if (!canManageRole('SUPER_ADMIN', 'ADMIN_ORGANIZACION') || !canManageRole('SUPER_ADMIN', 'ODONTOLOGO')) {
    throw new Error('FALLO: SUPER_ADMIN debería poder administrar todos los roles.');
  }

  // Admin Organización solo puede administrar roles inferiores (ADMIN_SUCURSAL, ODONTOLOGO, etc.)
  if (!canManageRole('ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL') || !canManageRole('ADMIN_ORGANIZACION', 'ODONTOLOGO')) {
    throw new Error('FALLO: ADMIN_ORGANIZACION debe poder administrar roles inferiores.');
  }

  // Admin Organización NO puede administrar SUPER_ADMIN ni a otro ADMIN_ORGANIZACION (anti-escalamiento)
  if (canManageRole('ADMIN_ORGANIZACION', 'SUPER_ADMIN')) {
    throw new Error('FALLO DE SEGURIDAD: ADMIN_ORGANIZACION nunca debe poder administrar a SUPER_ADMIN.');
  }
  if (canManageRole('ADMIN_ORGANIZACION', 'ADMIN_ORGANIZACION')) {
    throw new Error('FALLO DE SEGURIDAD: ADMIN_ORGANIZACION no debe poder administrar a usuarios de nivel igual.');
  }

  // Admin de Sucursal NO puede crear sucursales ni administrar roles superiores
  if (canManageRole('ADMIN_SUCURSAL', 'ADMIN_ORGANIZACION') || canManageRole('ADMIN_SUCURSAL', 'SUPER_ADMIN')) {
    throw new Error('FALLO DE SEGURIDAD: ADMIN_SUCURSAL no debe tener autoridad sobre roles superiores.');
  }
  console.log('✓ Jerarquía estricta y protección de SUPER_ADMIN verificadas exitosamente.');

  // -------------------------------------------------------------------------
  // TEST 2: Intentos de Escalamiento de Privilegios en Backend
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Evaluando intentos directos de escalamiento en backend (validateBackendAuthorization)...');

  // Caso 2.1: Admin Organización intenta auto-asignarse rol SUPER_ADMIN
  const privilegeEscalationCheck = validateBackendAuthorization({
    actor: {
      userId: 'user-org-admin-1',
      role: 'ADMIN_ORGANIZACION',
      organizationId: snapshot.organization.id,
    },
    resource: 'USER',
    action: 'UPDATE',
    targetUserId: 'user-org-admin-1',
    targetUserRole: 'ADMIN_ORGANIZACION',
    newRoleToAssign: 'SUPER_ADMIN',
  });

  if (privilegeEscalationCheck.authorized || privilegeEscalationCheck.statusCode !== 403) {
    throw new Error('FALLO DE SEGURIDAD: Backend permitió intento de escalamiento a SUPER_ADMIN.');
  }
  console.log(`✓ Escalamiento a SUPER_ADMIN bloqueado: ${privilegeEscalationCheck.reason}`);

  // Caso 2.2: Admin Organización intenta modificar o resetear al Super Administrador
  const superAdminTamperCheck = validateBackendAuthorization({
    actor: {
      userId: 'user-org-admin-1',
      role: 'ADMIN_ORGANIZACION',
      organizationId: snapshot.organization.id,
    },
    resource: 'USER',
    action: 'RESET_PASSWORD',
    targetUserId: snapshot.users.find((u) => u.roleId === 'SUPER_ADMIN')?.id || 'super-admin-id',
    targetUserRole: 'SUPER_ADMIN',
  });

  if (superAdminTamperCheck.authorized || superAdminTamperCheck.statusCode !== 403) {
    throw new Error('FALLO DE SEGURIDAD: Backend permitió modificar a SUPER_ADMIN por un rol inferior.');
  }
  console.log(`✓ Modificación de SUPER_ADMIN por rol inferior bloqueada: ${superAdminTamperCheck.reason}`);

  // Caso 2.3: Admin de Sucursal intenta eliminar una sucursal
  const branchDeleteCheck = validateBackendAuthorization({
    actor: {
      userId: 'user-branch-admin-1',
      role: 'ADMIN_SUCURSAL',
      organizationId: snapshot.organization.id,
      allowedBranchIds: [snapshot.branches[0].id],
    },
    resource: 'BRANCH',
    action: 'DELETE',
    targetBranchId: snapshot.branches[0].id,
  });

  if (branchDeleteCheck.authorized || branchDeleteCheck.statusCode !== 403) {
    throw new Error('FALLO DE SEGURIDAD: Backend permitió a ADMIN_SUCURSAL eliminar una sucursal.');
  }
  console.log(`✓ Eliminación de sucursal por ADMIN_SUCURSAL bloqueada: ${branchDeleteCheck.reason}`);

  // -------------------------------------------------------------------------
  // TEST 3: Control Granular de Permisos por Usuario (Asignar, Revocar, Deny Wins)
  // -------------------------------------------------------------------------
  console.log('\n[Test 3] Evaluando asignación granular y regla "Deny Overrides Allow"...');

  const testUser = dbStore.findUserByEmail('valeria.gomez@odontosol.com.py') || snapshot.users.find((u) => u.roleId === 'ODONTOLOGO');
  if (!testUser) throw new Error('No se encontró usuario odontólogo de prueba en la base de datos.');

  const superAdminUser = dbStore.findUserByEmail('lucas.arrua@odontosol.com.py') || snapshot.users.find((u) => u.roleId === 'SUPER_ADMIN');
  const superAdminActor = {
    userId: superAdminUser!.id,
    role: 'SUPER_ADMIN',
    organizationId: testUser.organizationId,
  };

  // Paso 3.1: Verificar que inicialmente tiene 'clinical.view' por su rol
  const initialEffective = dbStore.getUserEffectivePermissions(testUser.id);
  if (!initialEffective.effectivePermissions.includes('clinical.view')) {
    throw new Error('FALLO: Odontólogo debería tener clinical.view por defecto.');
  }
  console.log(`✓ Permiso base confirmado: ${testUser.firstName} posee clinical.view por su rol.`);

  // Paso 3.2: El Super Administrador REVOCA explícitamente 'clinical.view'
  console.log('Revocando "clinical.view" para el odontólogo...');
  dbStore.updateUserPermissions(
    testUser.id,
    {
      revokedPermissions: ['clinical.view'],
    },
    superAdminActor
  );

  const updatedEffective = dbStore.getUserEffectivePermissions(testUser.id);
  if (updatedEffective.effectivePermissions.includes('clinical.view')) {
    throw new Error('FALLO CRÍTICO: Permiso revocado "clinical.view" todavía figura en effectivePermissions.');
  }

  // Comprobar con hasPermission sobre el objeto de usuario
  const hasPermAfterRevoke = hasPermission(mockUser(testUser, { revokedPermissions: ['clinical.view'] }), 'clinical.view');
  if (hasPermAfterRevoke) {
    throw new Error('FALLO CRÍTICO: hasPermission devolvió true para un permiso revocado explícitamente (Violación de Deny Overrides Allow).');
  }
  console.log('✓ Regla "Deny Overrides Allow" validada: clinical.view bloqueado inmediatamente tras revocación.');

  // Paso 3.3: Otorgar un permiso que el rol NO tiene (ej: 'reports.financial')
  console.log('Otorgando concesión personalizada "reports.financial"...');
  dbStore.updateUserPermissions(
    testUser.id,
    {
      customPermissions: ['reports.financial'],
      revokedPermissions: ['clinical.view'],
    },
    superAdminActor
  );

  const hasCustomPerm = hasPermission(
    mockUser(testUser, { customPermissions: ['reports.financial'], revokedPermissions: ['clinical.view'] }),
    'reports.financial'
  );
  if (!hasCustomPerm) {
    throw new Error('FALLO: Concesión personalizada "reports.financial" no fue autorizada.');
  }
  console.log('✓ Concesión personalizada aplicada: reports.financial concedido exitosamente.');

  // -------------------------------------------------------------------------
  // TEST 4: Restricciones Sanitarias Regulatorias del MSPBS
  // -------------------------------------------------------------------------
  console.log('\n[Test 4] Evaluando Restricciones Sanitarias Regulatorias (MSPBS)...');

  // Asignar restricción de segregación financiera y restricción de inmutabilidad
  console.log('Asignando restricción MSPBS: "restrict_financial_to_cashiers"...');
  dbStore.updateUserPermissions(
    testUser.id,
    {
      customPermissions: ['cash.open_close', 'reports.financial'],
      assignedRestrictions: ['restrict_financial_to_cashiers'],
      revokedPermissions: [],
    },
    superAdminActor
  );

  const userWithRestriction = mockUser(testUser, {
    customPermissions: ['cash.open_close'],
    assignedRestrictions: ['restrict_financial_to_cashiers'],
  });

  // Aunque se le dio customPermission 'cash.open_close', la restricción MSPBS DEBE BLOQUEARLO
  const canOpenCash = hasPermission(userWithRestriction, 'cash.open_close');
  if (canOpenCash) {
    throw new Error('FALLO CRÍTICO: La restricción regulatoria MSPBS no bloqueó la acción sensible "cash.open_close".');
  }
  console.log('✓ Restricción sanitaria activa bloqueó categóricamente "cash.open_close" a pesar de custom grant.');

  // Prohibición absoluta de borrado físico de pacientes
  const canDeletePatient = hasPermission(
    mockUser(testUser, { assignedRestrictions: ['prohibit_hard_deletion_clinical'] }),
    'patients.delete'
  );
  if (canDeletePatient) {
    throw new Error('FALLO: Prohibición de borrado físico de pacientes no fue acatada.');
  }
  console.log('✓ Restricción MSPBS de no borrado físico validada: patients.delete denegado.');

  // -------------------------------------------------------------------------
  // TEST 5: Control de Visualización de Módulos (allowedNavTabs)
  // -------------------------------------------------------------------------
  console.log('\n[Test 5] Evaluando control de módulos de navegación (allowedNavTabs)...');

  // Limitar módulos del usuario únicamente a ['agenda', 'patients']
  dbStore.updateUserPermissions(
    testUser.id,
    {
      allowedNavTabs: ['agenda', 'patients'],
    },
    superAdminActor
  );

  const tabsEffective = dbStore.getUserEffectivePermissions(testUser.id);
  if (tabsEffective.allowedNavTabs.includes('clinical') || tabsEffective.allowedNavTabs.includes('cash')) {
    throw new Error('FALLO: allowedNavTabs contiene módulos no autorizados.');
  }
  if (!tabsEffective.allowedNavTabs.includes('agenda') || !tabsEffective.allowedNavTabs.includes('patients')) {
    throw new Error('FALLO: allowedNavTabs no contiene los módulos asignados.');
  }
  console.log(`✓ Módulos autorizados configurados exactamente: [${tabsEffective.allowedNavTabs.join(', ')}]`);

  // -------------------------------------------------------------------------
  // TEST 6: Actualización Inmediata y Versionado de Políticas (permissionsVersion)
  // -------------------------------------------------------------------------
  console.log('\n[Test 6] Evaluando incremento de permissionsVersion y revocación de sesiones...');

  const userBefore = dbStore.findUserById(testUser.id);
  const versionBefore = (userBefore as any).permissionsVersion || 1;

  dbStore.updateUserPermissions(
    testUser.id,
    {
      customPermissions: [],
      revokedPermissions: [],
      assignedRestrictions: [],
      allowedNavTabs: ['dashboard', 'agenda'],
    },
    superAdminActor
  );

  const userAfter = dbStore.findUserById(testUser.id);
  const versionAfter = (userAfter as any).permissionsVersion;

  if (versionAfter <= versionBefore) {
    throw new Error(`FALLO: permissionsVersion no se incrementó (${versionBefore} -> ${versionAfter}).`);
  }
  console.log(`✓ permissionsVersion incrementado correctamente: v${versionBefore} -> v${versionAfter}`);

  // Test de Revocación de Sesión Forzosa
  console.log('Ejecutando revocación forzosa de sesiones activas...');
  const testIssuedAt = new Date(Date.now() - 10000).toISOString();
  dbStore.revokeUserSessions(testUser.id, superAdminActor.userId);

  const isRevoked = dbStore.isSessionRevoked(testUser.id, testIssuedAt);
  if (!isRevoked) {
    throw new Error('FALLO: La sesión previa al timestamp de revocación no fue marcada como revocada.');
  }
  console.log('✓ Sesión activa revocada inmediatamente y detectada en validación de seguridad.');

  // -------------------------------------------------------------------------
  // TEST 7: Auditoría Trazable de Quién Otorgó o Retiró Permisos
  // -------------------------------------------------------------------------
  console.log('\n[Test 7] Verificando registro de auditoría médica y trazabilidad...');

  const auditLogs = dbStore.getAuditLogs(superAdminActor);
  const permissionAudit = auditLogs.find((l) => l.action === 'USER_PERMISSIONS_OVERRIDE' && l.entityId === testUser.id);

  if (!permissionAudit) {
    throw new Error('FALLO: No se encontró registro de auditoría para USER_PERMISSIONS_OVERRIDE.');
  }

  if (permissionAudit.userId !== superAdminActor.userId) {
    throw new Error('FALLO: El usuario responsable registrado en auditoría no coincide con el actor.');
  }

  console.log('✓ Auditoría confirmada:');
  console.log(`   - Acción: ${permissionAudit.action}`);
  console.log(`   - Modificado por: ${superAdminUser?.firstName} ${superAdminUser?.lastName} (ID: ${permissionAudit.userId})`);
  console.log(`   - Usuario afectado: ${testUser.firstName} ${testUser.lastName} (ID: ${permissionAudit.entityId})`);
  console.log(`   - Fecha y hora: ${new Date(permissionAudit.createdAt).toISOString()}`);

  console.log('\n================================================================');
  console.log('✓✓✓ TODAS LAS PRUEBAS OBLIGATORIAS DE RBAC, PERMISOS Y MSPBS PASARON EXITOSAMENTE ✓✓✓');
  console.log('================================================================');
}

function mockUser(baseUser: any, overrides: any) {
  return {
    ...baseUser,
    ...overrides,
  };
}

runRbacPermissionsTest().catch((err) => {
  console.error('\n❌ ERROR EN AUDITORÍA DE SEGURIDAD:', err);
  process.exit(1);
});
