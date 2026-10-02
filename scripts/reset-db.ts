import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateInitialSeedData } from '../src/db/seeds/initial-seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db_store.json');

async function resetDatabase() {
  console.log('🔄 Iniciando restablecimiento de la base de datos a estado inicial de fábrica (Seed)...');

  // Asegurar existencia de directorio data
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Generar datos maestros iniciales (Paraguay multi-sucursal, catálogos, roles RBAC y usuarios)
  const seedData = generateInitialSeedData();
  const payload = {
    data: seedData,
    organizationsList: [seedData.organization],
  };

  // Escribir archivo persistente en disco
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);

  console.log(`✅ Base de datos persistente restablecida con éxito en: ${DB_FILE}`);
  console.log(`   - Organización: ${seedData.organization.name} (${seedData.organization.taxId})`);
  console.log(`   - Sucursales: ${seedData.branches.length} operativas`);
  console.log(`   - Usuarios: ${seedData.users.length} con roles institucionales`);
  console.log(`   - Servicios odontológicos: ${seedData.services.length} en Guaraníes (PYG)`);

  // Si el servidor Express está activo, sincronizar inmediatamente en caliente
  try {
    const res = await fetch('http://localhost:3000/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('⚡ Servidor en vivo sincronizado en caliente sin necesidad de reinicio.');
    }
  } catch (err) {
    // Servidor no activo en este momento; se cargará automáticamente al arrancar
  }

  console.log('\n✨ Restablecimiento completado. Puede ingresar con las credenciales maestras:');
  console.log('   👤 Usuario: admin@odontosol.com.py');
  console.log('   🔑 Contraseña: Admin2026! (o OdontoSol2026!)');
}

resetDatabase().catch((err) => {
  console.error('❌ Error restableciendo la base de datos:', err);
  process.exit(1);
});
