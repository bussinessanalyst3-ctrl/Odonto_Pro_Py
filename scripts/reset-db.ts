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

  console.log('\n✨ Restablecimiento local completado.');
  console.log('   ℹ️  El servidor cargará el estado desde PostgreSQL (si DATABASE_URL está configurado) o desde data/db_store.json.');
}

resetDatabase().catch((err) => {
  console.error('❌ Error restableciendo la base de datos:', err);
  process.exit(1);
});
