import crypto from 'crypto';

/**
 * Verificación criptográfica segura PBKDF2-HMAC-SHA256 con comparación en tiempo constante
 */
export function verifyPbkdf2Hash(
  password: string,
  saltHex: string,
  iterations: number,
  targetHashHex: string
): boolean {
  try {
    const saltBuf = Buffer.from(saltHex, 'hex');
    const derived = crypto.pbkdf2Sync(password, saltBuf, iterations || 100000, 32, 'sha256');
    const targetBuf = Buffer.from(targetHashHex, 'hex');
    if (derived.length !== targetBuf.length) return false;
    return crypto.timingSafeEqual(derived, targetBuf);
  } catch {
    return false;
  }
}

/**
 * Genera hash y salt criptográfico seguro PBKDF2-HMAC-SHA256
 */
export function createPbkdf2Hash(
  password: string,
  iterations: number = 100000
): { hash: string; salt: string; iterations: number } {
  const salt = crypto.randomBytes(16).toString('hex');
  const saltBuf = Buffer.from(salt, 'hex');
  const hash = crypto.pbkdf2Sync(password, saltBuf, iterations, 32, 'sha256').toString('hex');
  return { hash, salt, iterations };
}

/**
 * Sanitiza los datos de usuarios para que NUNCA expongan contraseñas o hashes a ningún cliente
 */
export function sanitizeUsersForClient(users: any[]): any[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) => {
    const { passwordHash, passwordSalt, passwordIterations, ...safeUser } = u;
    return safeUser;
  });
}
