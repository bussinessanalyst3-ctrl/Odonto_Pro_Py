import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateInitialSeedData } from './src/db/seeds/initial-seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory server-side state initialized from persistent file or seed
let serverDbState: {
  data: any;
  organizationsList: any[];
};

function loadDatabaseState() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && parsed.organizationsList && Array.isArray(parsed.organizationsList)) {
        serverDbState = parsed;
        console.log(`[Backend Database] Loaded persistent state with ${serverDbState.organizationsList.length} organization(s).`);
        return;
      }
    }
  } catch (err) {
    console.error('[Backend Database] Error reading persistent db_store.json:', err);
  }

  // Fallback to initial seed
  const initial = generateInitialSeedData();
  serverDbState = {
    data: initial,
    organizationsList: [initial.organization],
  };
  saveDatabaseState();
  console.log('[Backend Database] Initialized fresh database state from seed.');
}

function saveDatabaseState() {
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(serverDbState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[Backend Database] Error persisting to db_store.json:', err);
  }
}

// Initialize database on boot
loadDatabaseState();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Healthcheck & Diagnostic endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      organizations: serverDbState.organizationsList.map((o) => ({
        id: o.id,
        name: o.name,
        taxId: o.taxId,
        status: o.status,
      })),
      usersCount: serverDbState.data.users?.length || 0,
    });
  });

  // GET /api/db/state - Authoritative source of truth for all clients across all browsers
  app.get('/api/db/state', (req, res) => {
    res.json(serverDbState);
  });

  // POST /api/db/sync - Receive changes from authorized client and persist
  app.post('/api/db/sync', (req, res) => {
    const { data, organizationsList } = req.body;
    if (data && organizationsList && Array.isArray(organizationsList)) {
      serverDbState = {
        data,
        organizationsList,
      };
      saveDatabaseState();
      res.json({ success: true, timestamp: new Date().toISOString() });
    } else {
      res.status(400).json({ error: 'Payload inválido para sincronización de base de datos.' });
    }
  });

  // GET /api/organizations
  app.get('/api/organizations', (req, res) => {
    res.json(serverDbState.organizationsList);
  });

  // POST /api/organizations
  app.post('/api/organizations', (req, res) => {
    const newOrg = req.body;
    if (!newOrg || !newOrg.name) {
      return res.status(400).json({ error: 'El nombre de la organización es obligatorio.' });
    }

    const id = newOrg.id || crypto.randomUUID();
    const createdOrg = {
      id,
      code: newOrg.code || `ORG-${newOrg.taxId ? newOrg.taxId.replace(/[^A-Za-z0-9]/g, '') : Date.now()}`,
      name: newOrg.name,
      legalName: newOrg.legalName || newOrg.name,
      taxId: newOrg.taxId || '80000000-1',
      countryCode: newOrg.countryCode || 'PRY',
      defaultCurrency: newOrg.defaultCurrency || 'PYG',
      timezone: newOrg.timezone || 'America/Asuncion',
      status: 'ACTIVE',
      phone: newOrg.phone || '+595 21 000 000',
      email: newOrg.email || 'contacto@clinica.com.py',
      address: newOrg.address || 'Asunción, Paraguay',
      primaryColor: newOrg.primaryColor || 'teal',
      logoUrl: newOrg.logoUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    serverDbState.organizationsList.push(createdOrg);

    // Create default branch for new company
    const defaultBranchId = crypto.randomUUID();
    const defaultBranch = {
      id: defaultBranchId,
      organizationId: id,
      code: 'SUC-01',
      name: `Casa Central - ${createdOrg.name}`,
      department: 'Capital',
      city: 'Asunción',
      neighborhood: 'Centro',
      address: createdOrg.address,
      phone: createdOrg.phone,
      whatsapp: createdOrg.phone,
      email: createdOrg.email,
      openingTime: '07:30',
      closingTime: '19:30',
      status: 'ACTIVE',
      isMain: true,
      operatingHours: 'Lun a Vie 08:00 - 18:00, Sáb 08:00 - 12:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    serverDbState.data.branches.push(defaultBranch);

    serverDbState.data.branchSettings.push({
      id: crypto.randomUUID(),
      branchId: defaultBranchId,
      allowOnlineBooking: true,
      requireDocumentId: true,
      enableWaitlist: true,
      maxOverbookingSlots: 0,
      reminderChannels: ['WHATSAPP', 'EMAIL'],
      defaultAppointmentDurationMinutes: 30,
      cancellationNoticeHours: 24,
      requireDepositForSpecialties: false,
      depositAmountPyg: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    saveDatabaseState();
    res.status(201).json(createdOrg);
  });

  // PUT /api/organizations/:id
  app.put('/api/organizations/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const idx = serverDbState.organizationsList.findIndex((o) => o.id === id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Organización no encontrada.' });
    }

    serverDbState.organizationsList[idx] = {
      ...serverDbState.organizationsList[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (serverDbState.data.organization?.id === id) {
      serverDbState.data.organization = { ...serverDbState.organizationsList[idx] };
    }

    saveDatabaseState();
    res.json(serverDbState.organizationsList[idx]);
  });

  // DELETE /api/organizations/:id
  app.delete('/api/organizations/:id', (req, res) => {
    const { id } = req.params;
    if (serverDbState.organizationsList.length <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar la única organización registrada.' });
    }
    const idx = serverDbState.organizationsList.findIndex((o) => o.id === id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Organización no encontrada.' });
    }

    serverDbState.organizationsList[idx].status = 'INACTIVE';
    serverDbState.organizationsList[idx].deletedAt = new Date().toISOString();

    if (serverDbState.data.organization?.id === id) {
      const active = serverDbState.organizationsList.find((o) => o.id !== id && o.status === 'ACTIVE') || serverDbState.organizationsList[0];
      serverDbState.data.organization = active;
    }

    saveDatabaseState();
    res.json({ success: true, message: 'Organización dada de baja correctamente.' });
  });

  // Vite Integration: middleware mode
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OdontoPro Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
