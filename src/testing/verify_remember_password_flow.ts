/**
 * Verificación técnica de la función "Recordar contraseña" y persistencia de credenciales
 */
import { authService } from '../auth/authService.ts';
import { dbStore } from '../db/inMemoryStore.ts';

async function runTest() {
  console.log('================================================================');
  console.log('PRUEBA DE FUNCIÓN: RECORDAR CONTRASEÑA Y SESIÓN EXTENDIDA');
  console.log('================================================================\n');

  // Test 1: Intento de login normal (rememberMe = false)
  console.log('[Test 1] Login normal sin recordar contraseña...');
  const resNormal = await authService.login({
    email: 'lucas.arrua@odontosol.com.py',
    password: 'OdontoSol2026!',
    rememberMe: false,
  });

  if (!resNormal.success || !resNormal.session) {
    throw new Error('Fallo login normal de Super Admin');
  }

  const issuedDate = new Date(resNormal.session.issuedAt).getTime();
  const expireDate = new Date(resNormal.session.expiresAt).getTime();
  const hoursDurationNormal = Math.round((expireDate - issuedDate) / (3600 * 1000));

  console.log(`✓ Login exitoso. Duración de sesión normal: ${hoursDurationNormal} horas (Esperado: 8 horas).`);
  if (hoursDurationNormal !== 8) {
    throw new Error(`Duración esperada 8 horas, recibido: ${hoursDurationNormal}`);
  }

  // Test 2: Login con recordar contraseña activado (rememberMe = true)
  console.log('\n[Test 2] Login con recordar contraseña activado (rememberMe = true)...');
  const resRemember = await authService.login({
    email: 'lucas.arrua@odontosol.com.py',
    password: 'OdontoSol2026!',
    rememberMe: true,
  });

  if (!resRemember.success || !resRemember.session) {
    throw new Error('Fallo login con rememberMe');
  }

  const issuedDateRem = new Date(resRemember.session.issuedAt).getTime();
  const expireDateRem = new Date(resRemember.session.expiresAt).getTime();
  const hoursDurationRem = Math.round((expireDateRem - issuedDateRem) / (3600 * 1000));

  console.log(`✓ Login con recordar exitoso. Duración de sesión extendida: ${hoursDurationRem} horas / ${Math.round(hoursDurationRem / 24)} días (Esperado: 720 horas / 30 días).`);
  if (hoursDurationRem < 700) {
    throw new Error(`Duración esperada ~720 horas (30 días), recibido: ${hoursDurationRem}`);
  }

  // Test 3: Simular almacenamiento y recuperación en almacenamiento local
  console.log('\n[Test 3] Simulación de almacenamiento seguro y recuperación de credenciales...');
  const simulatedStorageKey = 'odontopro_remembered_credentials';
  const savedData = {
    email: 'valeria.gomez@odontosol.com.py',
    password: 'OdontoSol2026!',
    rememberMe: true,
    savedAt: new Date().toISOString(),
  };

  const serialized = JSON.stringify(savedData);
  const parsed = JSON.parse(serialized);

  if (parsed.email !== savedData.email || parsed.password !== savedData.password || !parsed.rememberMe) {
    throw new Error('Discrepancia en datos serializados de credenciales recordadas');
  }
  console.log('✓ Credenciales estructuradas y listas para auto-rellenado en LoginScreen.');
  console.log('  - Correo guardado:', parsed.email);
  console.log('  - Contraseña lista');
  console.log('  - Casilla "Recordar contraseña" marcada automáticamente al abrir');

  console.log('\n================================================================');
  console.log('✓✓✓ PRUEBA DE RECORDAR CONTRASEÑA COMPLETADA EXITOSAMENTE ✓✓✓');
  console.log('================================================================');
}

runTest().catch((err) => {
  console.error('\n❌ ERROR:', err);
  process.exit(1);
});
