/**
 * Módulo Criptográfico de Contraseñas del Sistema Clínico OdontoSol
 * 
 * Implementa Criptografía de Estándar Bancario y Médico (Web Crypto API):
 * - Derivación con PBKDF2 (Password-Based Key Derivation Function 2)
 * - HMAC-SHA256 con 100,000 iteraciones
 * - Salt criptográfico único por cada usuario
 * - Comparación de tiempo constante (anti-timing attacks)
 * 
 * NINGUNA CONTRASEÑA EN TEXTO PLANO SE ALMACENA NI APARECE EN EL CÓDIGO.
 */

export interface PasswordHashRecord {
  hash: string; // Hexadecimal del hash derivado
  salt: string; // Hexadecimal del salt criptográfico
  iterations: number;
}

const ITERATIONS = 100000;
const KEY_LEN_BYTES = 32; // 256 bits

/**
 * Convierte un ArrayBuffer a string hexadecimal
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convierte un string hexadecimal a Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Genera un salt criptográficamente seguro
 */
export function generateSalt(byteLength: number = 16): string {
  const saltBytes = new Uint8Array(byteLength);
  crypto.getRandomValues(saltBytes);
  return bufferToHex(saltBytes.buffer);
}

/**
 * Deriva el hash PBKDF2 de una contraseña usando un salt dado
 */
export async function hashPassword(
  plainText: string,
  saltHex?: string,
  iterations: number = ITERATIONS
): Promise<PasswordHashRecord> {
  const enc = new TextEncoder();
  const salt = saltHex || generateSalt();
  const saltBuffer = hexToBytes(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(plainText),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer.buffer as ArrayBuffer,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LEN_BYTES * 8
  );

  return {
    hash: bufferToHex(derivedBits),
    salt,
    iterations,
  };
}

/**
 * Verifica si una contraseña en texto plano coincide con el hash almacenado
 * Utiliza comparación de tiempo constante para evitar ataques de temporización (timing attacks).
 */
export async function verifyPassword(
  plainText: string,
  storedHash: string,
  storedSalt: string,
  iterations: number = ITERATIONS
): Promise<boolean> {
  try {
    const computed = await hashPassword(plainText, storedSalt, iterations);
    
    // Comparación segura en tiempo constante
    if (computed.hash.length !== storedHash.length) {
      return false;
    }
    
    let mismatch = 0;
    for (let i = 0; i < computed.hash.length; i++) {
      mismatch |= computed.hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    
    return mismatch === 0;
  } catch (error) {
    console.error('Error durante la verificación criptográfica:', error);
    return false;
  }
}
