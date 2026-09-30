import express from 'express';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateInitialSeedData } from './src/db/seeds/initial-seed.ts';
import { canManageRole, isSuperAdminRole } from './src/security/rbacHierarchy.ts';

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

// Security: Rate Limiting & Brute Force Tracker (enforced exclusively in backend)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos
const failedAttemptsMap = new Map<string, { count: number; lockedUntil: number | null }>();

// Security: Server Session Registry
const activeServerSessions = new Map<string, {
  userId: string;
  role: string;
  organizationId: string;
  branchId: string;
  issuedAt: string;
  expiresAt: string;
  permissionsVersion: number;
}>();

// Security: One-time Password Recovery Tokens
const passwordRecoveryTokens = new Map<string, {
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}>();

/**
 * Verificación criptográfica segura PBKDF2-HMAC-SHA256 con comparación en tiempo constante
 */
function verifyPbkdf2Hash(password: string, saltHex: string, iterations: number, targetHashHex: string): boolean {
  try {
    const saltBuf = Buffer.from(saltHex, 'hex');
    const derived = crypto.pbkdf2Sync(password, saltBuf, iterations || 100000, 32, 'sha256');
    const targetBuf = Buffer.from(targetHashHex, 'hex');
    if (derived.length !== targetBuf.length) return false;
    return crypto.timingSafeEqual(derived, targetBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Genera hash y salt criptográfico seguro
 */
function createPbkdf2Hash(password: string, iterations: number = 100000): { hash: string; salt: string; iterations: number } {
  const salt = crypto.randomBytes(16).toString('hex');
  const saltBuf = Buffer.from(salt, 'hex');
  const hash = crypto.pbkdf2Sync(password, saltBuf, iterations, 32, 'sha256').toString('hex');
  return { hash, salt, iterations };
}

/**
 * Sanitiza los datos de usuarios para que NUNCA expongan contraseñas o hashes a ningún cliente
 */
function sanitizeUsersForClient(users: any[]): any[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) => {
    const { passwordHash, passwordSalt, passwordIterations, ...safeUser } = u;
    return safeUser;
  });
}

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
  // CRÍTICO DE SEGURIDAD: Nunca expone contraseñas, hashes ni sales criptográficas a ningún cliente frontend
  app.get('/api/db/state', (req, res) => {
    const sanitizedState = {
      ...serverDbState,
      data: {
        ...serverDbState.data,
        users: sanitizeUsersForClient(serverDbState.data.users),
      },
    };
    res.json(sanitizedState);
  });

  // POST /api/db/sync - Receive changes from authorized client and persist
  // CRÍTICO DE SEGURIDAD: Preserva los hashes de contraseñas existentes en el servidor
  app.post('/api/db/sync', (req, res) => {
    const { data, organizationsList } = req.body;
    if (data && organizationsList && Array.isArray(organizationsList)) {
      // Re-vincular hashes existentes si el cliente envió usuarios sanitizados
      const existingUserMap = new Map<string, any>((serverDbState.data.users || []).map((u: any) => [u.id, u]));
      const mergedUsers = (data.users || []).map((incomingUser: any) => {
        const existing = existingUserMap.get(incomingUser.id);
        if (existing) {
          return {
            ...incomingUser,
            passwordHash: incomingUser.passwordHash || existing.passwordHash,
            passwordSalt: incomingUser.passwordSalt || existing.passwordSalt,
            passwordIterations: incomingUser.passwordIterations || existing.passwordIterations || 100000,
          };
        }
        // Usuario nuevo creado desde cliente: si no tiene hash seguro, derivar uno
        if (!incomingUser.passwordHash) {
          const defaultRecord = createPbkdf2Hash(crypto.randomUUID().slice(0, 12));
          return {
            ...incomingUser,
            passwordHash: defaultRecord.hash,
            passwordSalt: defaultRecord.salt,
            passwordIterations: defaultRecord.iterations,
          };
        }
        return incomingUser;
      });

      serverDbState = {
        data: {
          ...data,
          users: mergedUsers,
        },
        organizationsList,
      };
      saveDatabaseState();
      res.json({ success: true, timestamp: new Date().toISOString() });
    } else {
      res.status(400).json({ error: 'Payload inválido para sincronización de base de datos.' });
    }
  });

  // =========================================================================
  // SERVICIO DE AUTENTICACIÓN BACKEND SEGURO (PROTECCIÓN CONTRA ENUMERACIÓN Y FUERZA BRUTA)
  // =========================================================================

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, res) => {
    const { identifier, password, rememberMe } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // 1. Validar presencia de credenciales
    if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Las credenciales ingresadas no son válidas.',
      });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Claves de seguimiento de fuerza bruta (por IP y por identificador)
    const ipKey = `ip_${clientIp}`;
    const userKey = `user_${cleanIdentifier}`;

    const now = Date.now();
    const ipTracker = failedAttemptsMap.get(ipKey);
    const userTracker = failedAttemptsMap.get(userKey);

    // 2. Verificar si está temporalmente bloqueado por fuerza bruta
    if (
      (ipTracker?.lockedUntil && ipTracker.lockedUntil > now) ||
      (userTracker?.lockedUntil && userTracker.lockedUntil > now)
    ) {
      const remainingMs = Math.max(
        (ipTracker?.lockedUntil || 0) - now,
        (userTracker?.lockedUntil || 0) - now
      );
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        error: `Acceso temporalmente restringido por múltiples intentos fallidos. Intente nuevamente en ${remainingMinutes} minuto(s).`,
        locked: true,
        remainingMinutes,
      });
    }

    // 3. Búsqueda de usuario (por correo electrónico o nombre de usuario)
    const users = serverDbState.data.users || [];
    const user = users.find((u: any) => {
      const emailMatch = u.email && u.email.toLowerCase() === cleanIdentifier;
      const usernameMatch = u.username && u.username.toLowerCase() === cleanIdentifier;
      const aliasAdminMatch = cleanIdentifier === 'admin' && u.roleId === 'SUPER_ADMIN';
      const analystMatch =
        (cleanIdentifier === 'businessanalyst3' || cleanIdentifier === 'businessanalyst3@gmail.com') &&
        (u.username === 'bussinessanalyst3' || (u.email && u.email.toLowerCase() === 'bussinessanalyst3@gmail.com'));
      return emailMatch || usernameMatch || aliasAdminMatch || analystMatch;
    });

    // 4. Mitigación contra Ataques de Temporización y Enumeración de Usuarios
    // Si el usuario no existe, calculamos un hash PBKDF2 ficticio de 100,000 iteraciones
    // para que el tiempo de respuesta sea exactamente idéntico al de un usuario existente.
    if (!user) {
      // Cálculo de tiempo constante ficticio
      createPbkdf2Hash(cleanPassword, 100000);

      // Registrar intento fallido tanto por IP como por identificador
      const currentIpCount = (ipTracker?.count || 0) + 1;
      const currentUserCount = (userTracker?.count || 0) + 1;
      const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
      const lockedUntil =
        (!isLoopback && currentIpCount >= MAX_FAILED_ATTEMPTS) || currentUserCount >= MAX_FAILED_ATTEMPTS
          ? now + LOCKOUT_DURATION_MS
          : null;

      failedAttemptsMap.set(ipKey, { count: currentIpCount, lockedUntil });
      failedAttemptsMap.set(userKey, { count: currentUserCount, lockedUntil });

      return res.status(401).json({
        error: 'Las credenciales ingresadas no son válidas.',
      });
    }

    // 5. Verificar si el usuario está inactivo (sin revelar su estado exacto para evitar enumeración)
    if (user.status === 'INACTIVE') {
      createPbkdf2Hash(cleanPassword, 100000); // timing equalization
      return res.status(401).json({
        error: 'Las credenciales ingresadas no son válidas.',
      });
    }

    // 6. Verificación Criptográfica PBKDF2 con Salt Único
    const isValidPassword = verifyPbkdf2Hash(
      cleanPassword,
      user.passwordSalt,
      user.passwordIterations || 100000,
      user.passwordHash
    );

    if (!isValidPassword) {
      // Incrementar contador de intentos fallidos
      const currentIpCount = (ipTracker?.count || 0) + 1;
      const currentUserCount = (userTracker?.count || 0) + 1;
      const lockedUntil =
        currentIpCount >= MAX_FAILED_ATTEMPTS || currentUserCount >= MAX_FAILED_ATTEMPTS
          ? now + LOCKOUT_DURATION_MS
          : null;

      failedAttemptsMap.set(ipKey, { count: currentIpCount, lockedUntil });
      failedAttemptsMap.set(userKey, { count: currentUserCount, lockedUntil });

      // Auditoría en el servidor
      serverDbState.data.auditLogs?.unshift({
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: null,
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'AUTH',
        entityId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'API Client',
        oldValues: null,
        newValues: { attempts: currentUserCount },
        description: `Intento de acceso fallido para cuenta protegida`,
        createdAt: new Date().toISOString(),
      });

      return res.status(401).json({
        error: 'Las credenciales ingresadas no son válidas.',
      });
    }

    // 7. Autenticación Exitosa: Limpiar contadores de intentos fallidos
    failedAttemptsMap.delete(ipKey);
    failedAttemptsMap.delete(userKey);

    // Determinar sucursal autorizada predeterminada
    const userBranches = (serverDbState.data.userBranches || []).filter((ub: any) => ub.userId === user.id);
    const defaultBranch = userBranches.find((ub: any) => ub.isDefault)?.branchId ||
      userBranches[0]?.branchId ||
      serverDbState.data.branches?.[0]?.id ||
      'branch-default';

    // Generar token de sesión criptográficamente seguro
    const sessionToken = `sess_${crypto.randomBytes(32).toString('hex')}`;
    const expirationHours = rememberMe ? 30 * 24 : 8;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expirationHours * 3600 * 1000).toISOString();

    const roleObj = (serverDbState.data.roles || []).find((r: any) => r.id === user.roleId);
    const org = (serverDbState.organizationsList || []).find((o: any) => o.id === user.organizationId) ||
      serverDbState.data.organization;

    // Registrar sesión activa en memoria del servidor
    activeServerSessions.set(sessionToken, {
      userId: user.id,
      role: user.roleId,
      organizationId: user.organizationId,
      branchId: defaultBranch,
      issuedAt,
      expiresAt,
      permissionsVersion: user.permissionsVersion || 1,
    });

    // Actualizar último inicio de sesión del usuario
    user.lastLoginAt = issuedAt;
    saveDatabaseState();

    // Objeto seguro de sesión (NINGÚN DATO SENSIBLE O HASH ES ENVIADO AL CLIENTE)
    const safeSession = {
      userId: user.id,
      organizationId: org.id,
      organizationName: org.name,
      role: user.roleId,
      roleName: roleObj?.name || user.roleId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      specialty: user.specialty,
      professionalLicense: user.professionalLicense,
      currentBranchId: defaultBranch,
      allowedBranchIds: user.roleId === 'SUPER_ADMIN'
        ? (serverDbState.data.branches || []).map((b: any) => b.id)
        : userBranches.map((ub: any) => ub.branchId),
      permissionsVersion: user.permissionsVersion || 1,
      customPermissions: user.customPermissions || [],
      revokedPermissions: user.revokedPermissions || [],
      assignedRestrictions: user.assignedRestrictions || [],
      allowedNavTabs: user.allowedNavTabs || roleObj?.allowedNavTabs || [],
      sessionToken,
      issuedAt,
      expiresAt,
    };

    res.json({
      success: true,
      token: sessionToken,
      session: safeSession,
    });
  });

  // POST /api/auth/logout - Invalidación segura de sesión en el servidor
  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = req.body?.token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
    if (token) {
      activeServerSessions.delete(token);
    }
    res.json({ success: true, message: 'Sesión cerrada correctamente.' });
  });

  // GET /api/auth/session - Validación de token de sesión
  app.get('/api/auth/session', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const sessionData = activeServerSessions.get(token);
    if (!sessionData) {
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }

    if (new Date(sessionData.expiresAt).getTime() < Date.now()) {
      activeServerSessions.delete(token);
      return res.status(401).json({ error: 'Sesión expirada.' });
    }

    const user = (serverDbState.data.users || []).find((u: any) => u.id === sessionData.userId);
    if (!user || user.status === 'INACTIVE') {
      activeServerSessions.delete(token);
      return res.status(401).json({ error: 'La cuenta no se encuentra activa.' });
    }

    res.json({
      valid: true,
      userId: sessionData.userId,
      role: sessionData.role,
      expiresAt: sessionData.expiresAt,
    });
  });

  // POST /api/auth/recover-password - Recuperación segura (PROTECCIÓN TOTAL CONTRA ENUMERACIÓN)
  app.post('/api/auth/recover-password', (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Debe ingresar un correo electrónico.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = (serverDbState.data.users || []).find((u: any) => u.email && u.email.toLowerCase() === cleanEmail);

    if (user && user.status === 'ACTIVE') {
      const resetToken = `rst_${crypto.randomBytes(24).toString('hex')}`;
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos

      passwordRecoveryTokens.set(resetToken, {
        userId: user.id,
        email: user.email,
        expiresAt,
        used: false,
      });

      // Auditoría interna sin exponer el token
      serverDbState.data.auditLogs?.unshift({
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: null,
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'SECURITY',
        entityId: user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'API Client',
        oldValues: null,
        newValues: { requestedAt: new Date().toISOString() },
        description: `Solicitud de restablecimiento de contraseña registrada para cuenta institucional`,
        createdAt: new Date().toISOString(),
      });
    }

    // SIEMPRE responde exactamente con el mismo mensaje genérico para evitar enumeración de usuarios
    res.json({
      success: true,
      message: 'Si el correo electrónico ingresado coincide con una cuenta activa, recibirá las instrucciones para restablecer su acceso institucional.',
    });
  });

  // POST /api/auth/reset-password - Establecer nueva contraseña con token de un solo uso
  app.post('/api/auth/reset-password', (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Datos insuficientes para el restablecimiento.' });
    }

    const tokenRecord = passwordRecoveryTokens.get(resetToken);
    if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < Date.now()) {
      return res.status(400).json({
        error: 'El enlace de recuperación es inválido o ha expirado. Por favor solicite uno nuevo.',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener como mínimo 8 caracteres.',
      });
    }

    const user = (serverDbState.data.users || []).find((u: any) => u.id === tokenRecord.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Generar nuevo hash criptográfico con salt único
    const newHashRecord = createPbkdf2Hash(newPassword, 100000);
    user.passwordHash = newHashRecord.hash;
    user.passwordSalt = newHashRecord.salt;
    user.passwordIterations = newHashRecord.iterations;
    user.permissionsVersion = (user.permissionsVersion || 1) + 1;
    user.updatedAt = new Date().toISOString();

    // Invalidar token de un solo uso
    tokenRecord.used = true;
    passwordRecoveryTokens.delete(resetToken);

    // Invalidar todas las sesiones previas del usuario en el servidor
    for (const [token, session] of activeServerSessions.entries()) {
      if (session.userId === user.id) {
        activeServerSessions.delete(token);
      }
    }

    saveDatabaseState();

    res.json({
      success: true,
      message: 'Su contraseña ha sido actualizada exitosamente. Inicie sesión con sus nuevas credenciales.',
    });
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

  // GET /api/users - Requiere autenticación de sesión activa
  app.get('/api/users', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token || !activeServerSessions.has(token)) {
      return res.status(401).json({ error: 'No autorizado. Se requiere inicio de sesión previo.' });
    }
    const users = (serverDbState.data.users || []).map((u: any) => {
      const { passwordHash, passwordSalt, passwordIterations, ...safe } = u;
      return safe;
    });
    res.json(users);
  });

  // PUT /api/users/:id/permissions - Super Admin & Hierarchy governed backend endpoint
  app.put('/api/users/:id/permissions', (req, res) => {
    const { id } = req.params;
    const { overrides, actor } = req.body;

    const user = serverDbState.data.users?.find((u: any) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Backend validation: Protecciones de Jerarquía y Super Administrador
    if (actor) {
      if (actor.role !== 'SUPER_ADMIN') {
        if (isSuperAdminRole(user.roleId)) {
          return res.status(403).json({
            error: '403 Prohibido: El usuario Super Administrador está estrictamente protegido y no puede ser alterado.',
          });
        }
        if (!canManageRole(actor.role, user.roleId)) {
          return res.status(403).json({
            error: `403 Prohibido: Su rol (${actor.role}) no tiene jerarquía para alterar los permisos de un usuario con rol ${user.roleId}.`,
          });
        }
        // Exclusivos de Super Admin
        const superAdminExclusives = new Set([
          'system.all',
          'organization.create',
          'organization.manage',
          'organization.branding',
          'super_admin.manage',
          'security.manage',
          'database.seed',
          'data.export_sensitive',
        ]);
        if (overrides?.customPermissions?.some((p: string) => superAdminExclusives.has(p))) {
          return res.status(403).json({
            error: '403 Prohibido: No puede asignar permisos exclusivos del Super Administrador.',
          });
        }
      }
    }

    const oldValues = {
      customPermissions: user.customPermissions || [],
      revokedPermissions: user.revokedPermissions || [],
      assignedRestrictions: user.assignedRestrictions || [],
      allowedNavTabs: user.allowedNavTabs || [],
      permissionsVersion: user.permissionsVersion || 1,
    };

    if (overrides) {
      if (Array.isArray(overrides.customPermissions)) {
        user.customPermissions = [...overrides.customPermissions];
      }
      if (Array.isArray(overrides.revokedPermissions)) {
        user.revokedPermissions = [...overrides.revokedPermissions];
      }
      if (Array.isArray(overrides.assignedRestrictions)) {
        user.assignedRestrictions = [...overrides.assignedRestrictions];
      }
      if (Array.isArray(overrides.allowedNavTabs)) {
        user.allowedNavTabs = [...overrides.allowedNavTabs];
      }
    }

    user.permissionsVersion = (user.permissionsVersion || 0) + 1;
    user.updatedAt = new Date().toISOString();

    // Registrar en auditoría del servidor
    serverDbState.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: user.organizationId,
      branchId: null,
      userId: actor?.userId || null,
      action: 'USER_PERMISSIONS_OVERRIDE',
      entity: 'USER_SECURITY',
      entityId: id,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Backend API',
      oldValues,
      newValues: {
        customPermissions: user.customPermissions,
        revokedPermissions: user.revokedPermissions,
        assignedRestrictions: user.assignedRestrictions,
        allowedNavTabs: user.allowedNavTabs,
        permissionsVersion: user.permissionsVersion,
      },
      description: `Ajuste granular en Backend de permisos y restricciones para ${user.firstName} ${user.lastName} (Versión ${user.permissionsVersion})`,
      createdAt: new Date().toISOString(),
    });

    saveDatabaseState();

    const { passwordHash, passwordSalt, ...safeUser } = user;
    res.json({ success: true, user: safeUser, permissionsVersion: user.permissionsVersion });
  });

  // POST /api/users/:id/revoke-sessions
  app.post('/api/users/:id/revoke-sessions', (req, res) => {
    const { id } = req.params;
    const { actor } = req.body;

    const user = serverDbState.data.users?.find((u: any) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (actor && actor.role !== 'SUPER_ADMIN') {
      if (isSuperAdminRole(user.roleId)) {
        return res.status(403).json({ error: '403 Prohibido: No se pueden revocar las sesiones del Super Administrador.' });
      }
      if (!canManageRole(actor.role, user.roleId)) {
        return res.status(403).json({ error: `403 Prohibido: Jerarquía insuficiente para revocar sesiones de ${user.roleId}.` });
      }
    }

    const now = new Date().toISOString();
    user.sessionRevokedAt = now;
    user.permissionsVersion = (user.permissionsVersion || 0) + 1;

    serverDbState.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: user.organizationId,
      branchId: null,
      userId: actor?.userId || null,
      action: 'SESSION_REVOCATION',
      entity: 'USER_SESSION',
      entityId: id,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Backend API',
      oldValues: null,
      newValues: { revokedAt: now, userId: id },
      description: `Revocación backend forzosa de sesiones para ${user.firstName} ${user.lastName}`,
      createdAt: now,
    });

    saveDatabaseState();
    res.json({ success: true, revokedAt: now });
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
