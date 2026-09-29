/**
 * Verificación técnica del inicio de sesión con correo y/o nombre de usuario y contraseña
 */
import { authService } from '../auth/authService.ts';
import { dbStore } from '../db/inMemoryStore.ts';

async function runTest() {
  console.log('================================================================');
  console.log('PRUEBA DE INICIO DE SESIÓN POR CORREO O NOMBRE DE USUARIO');
  console.log('================================================================\n');

  // Test 1: Iniciar sesión con correo completo del Super Administrador
  console.log('[Test 1] Autenticación con correo electrónico institucional...');
  const resEmail = await authService.login({
    email: 'lucas.arrua@odontosol.com.py',
    password: 'OdontoSol2026!',
    rememberMe: false,
  });

  if (!resEmail.success || !resEmail.session) {
    throw new Error(`Fallo login con correo electrónico: ${resEmail.error}`);
  }
  console.log(`✓ Acceso exitoso con correo: ${resEmail.session.firstName} ${resEmail.session.lastName} (${resEmail.session.roleName})`);

  // Test 2: Iniciar sesión con nombre de usuario simple (username)
  console.log('\n[Test 2] Autenticación con nombre de usuario ("lucas.arrua")...');
  const resUsername = await authService.login({
    email: 'lucas.arrua', // Enviado en el campo identificador
    password: 'OdontoSol2026!',
    rememberMe: false,
  });

  if (!resUsername.success || !resUsername.session) {
    throw new Error(`Fallo login con nombre de usuario: ${resUsername.error}`);
  }
  console.log(`✓ Acceso exitoso con nombre de usuario: ${resUsername.session.firstName} ${resUsername.session.lastName} (${resUsername.session.email})`);
  if (resUsername.session.userId !== resEmail.session.userId) {
    throw new Error('El usuario identificado por correo y nombre de usuario no coincide');
  }

  // Test 3: Iniciar sesión como Odontóloga con username ("valeria.gomez")
  console.log('\n[Test 3] Autenticación de Odontóloga con nombre de usuario ("valeria.gomez")...');
  const resDentist = await authService.login({
    email: 'valeria.gomez',
    password: 'OdontoSol2026!',
  });

  if (!resDentist.success || !resDentist.session) {
    throw new Error(`Fallo login con username valeria.gomez: ${resDentist.error}`);
  }
  console.log(`✓ Acceso exitoso como odontóloga: ${resDentist.session.firstName} ${resDentist.session.lastName} (Rol: ${resDentist.session.role})`);
  if (resDentist.session.role !== 'ODONTOLOGO') {
    throw new Error(`Rol esperado ODONTOLOGO, recibido: ${resDentist.session.role}`);
  }

  // Test 4: Iniciar sesión como Administrador de Organización con username ("sofia.benitez")
  console.log('\n[Test 4] Autenticación de Admin Org con username ("sofia.benitez")...');
  const resOrgAdmin = await authService.login({
    email: 'sofia.benitez',
    password: 'OdontoSol2026!',
  });

  if (!resOrgAdmin.success || !resOrgAdmin.session) {
    throw new Error(`Fallo login con username sofia.benitez: ${resOrgAdmin.error}`);
  }
  console.log(`✓ Acceso exitoso como Admin Org: ${resOrgAdmin.session.firstName} (Rol: ${resOrgAdmin.session.role})`);

  // Test 5: Rechazo de credenciales incorrectas con nombre de usuario
  console.log('\n[Test 5] Validación de rechazo para contraseña errónea con nombre de usuario...');
  const resBadPwd = await authService.login({
    email: 'lucas.arrua',
    password: 'ContrasenaIncorrecta123!',
  });

  if (resBadPwd.success) {
    throw new Error('Error: Debería haberse rechazado la contraseña incorrecta');
  }
  console.log(`✓ Acceso rechazado correctamente: "${resBadPwd.error}"`);

  // Test 6: Rechazo para nombre de usuario inexistente
  console.log('\n[Test 6] Validación de rechazo para usuario o correo inexistente...');
  const resNonExistent = await authService.login({
    email: 'usuario_que_no_existe',
    password: 'OdontoSol2026!',
  });

  if (resNonExistent.success) {
    throw new Error('Error: Debería haberse rechazado el usuario inexistente');
  }
  console.log(`✓ Rechazo de usuario inexistente confirmado: "${resNonExistent.error}"`);

  console.log('\n================================================================');
  console.log('✓✓✓ TODAS LAS PRUEBAS DE ACCESO POR CORREO/USUARIO PASARON ✓✓✓');
  console.log('================================================================');
}

runTest().catch((err) => {
  console.error('\n❌ ERROR:', err);
  process.exit(1);
});
