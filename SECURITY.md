# ESTRATEGIA DE SEGURIDAD Y COMPLIANCE MÉDICO (SECURITY.md)
## Sistema Web para Clínica Odontológica en Paraguay
### Protección Integral de Datos Médicos, Multi-Tenancy y Prevención de Vulnerabilidades

---

## 1. PRINCIPIO DE AISLAMIENTO MULTI-TENANT Y ANTI-IDOR

El riesgo más crítico en aplicaciones SaaS y multi-sucursal es el **acceso no autorizado entre organizaciones o sucursales (IDOR - Insecure Direct Object References)**.

### 1.1 Regla de Oro del Backend
> **"Ningún endpoint ni Server Action confiará jamás en el `organization_id` o `branch_id` provisto por el cliente en el cuerpo de la petición o en parámetros de ruta sin validación criptográfica y de sesión."**

```typescript
// Patrón de Verificación Obligatorio en Servicios y Route Handlers
export async function verifyTenantAndBranchAccess(
  session: SessionUser,
  resourceOrgId: string,
  resourceBranchId?: string
) {
  // 1. Verificación de Organización (Inviolable)
  if (session.organizationId !== resourceOrgId) {
    throw new SecurityException("Acceso no autorizado: Intento de acceso cross-tenant detectado.");
  }

  // 2. Si el usuario es SUPER_ADMIN, posee acceso a todas las sucursales de su organización
  if (session.role === 'SUPER_ADMIN') {
    return true;
  }

  // 3. Verificación de Sucursal para roles operativos
  if (resourceBranchId) {
    const hasBranchAccess = session.allowedBranches.includes(resourceBranchId);
    if (!hasBranchAccess) {
      throw new SecurityException("Acceso no autorizado: Usuario no asignado a esta sucursal.");
    }
  }

  return true;
}
```

### 1.2 Protección contra Enumeración de Recursos
- Se prohíbe el uso de IDs secuenciales auto-incrementales (`1, 2, 3...`) en URLs públicas.
- Se utilizan **UUIDv4 criptográficamente seguros**, imposibilitando el scraping sistemático o adivinanza de recursos por fuerza bruta.

---

## 2. SEGURIDAD EN AUTENTICACIÓN Y GESTIÓN DE SESIONES

1. **Almacenamiento de Contraseñas**:
   - Algoritmo: `Argon2id` (v=19, m=65536, t=3, p=4) o `bcrypt` con factor de costo 12.
   - Prohibido terminantemente almacenar contraseñas en texto plano o con algoritmos obsoletos (MD5, SHA1, SHA256 sin salt).
2. **Cookies de Sesión**:
   - `HttpOnly`: Impide acceso a la cookie desde scripts de JavaScript (inmunidad contra robo de sesión por XSS).
   - `Secure`: Transmisión forzada únicamente sobre HTTPS/TLS 1.3.
   - `SameSite=Lax`: Protección nativa del navegador contra ataques CSRF (Cross-Site Request Forgery).
   - Expiración: Inactividad máxima de 8 horas, rotación automática de sesión ante cambios de privilegios o cambio de contraseña.
3. **Protección contra Fuerza Bruta (Brute-Force & Rate Limiting)**:
   - Bloqueo escalonado tras 5 intentos fallidos por correo electrónico o dirección IP.
   - Rate limiting a nivel Edge en Vercel / Middleware (máximo 60 peticiones por minuto por IP para endpoints públicos).

---

## 3. PROTECCIÓN DE DATOS MÉDICOS Y PRIVACIDAD DEL PACIENTE

Los datos estomatológicos y anamnesis constituyen **información médica confidencial** protegida por normativas de salud:

1. **Principio de Mínimo Privilegio (Least Privilege)**:
   - El personal de **Recepción y Caja** NO tiene acceso a diagnósticos médicos, historial de enfermedades de base, odontograma clínico detallado ni prescripciones farmacológicas.
   - Únicamente el **Odontólogo tratante** y directores médicos autorizados pueden visualizar y editar la historia clínica.
2. **Cero Exposición en el Navegador**:
   - Prohibido almacenar historiales médicos, diagnósticos o números de cédula en `localStorage`, `sessionStorage` o URLs.
   - Las respuestas de la API filtran rigurosamente campos médicos cuando el usuario solicitante no posee el rol clínico correspondiente.
3. **Cifrado en Tránsito y en Reposo**:
   - Tránsito: TLS 1.3 con certificados gestionados en Vercel.
   - Reposo: Cifrado AES-256 en la base de datos PostgreSQL gestionada (Neon / Supabase).

---

## 4. SEGURIDAD FINANCIERA (CAJA Y PAGOS EN GUARANÍES)

1. **Datos de Tarjetas de Crédito/Débito**:
   - El sistema **NUNCA** almacena números completos de tarjeta (PAN), códigos de seguridad (CVV/CVC) ni claves PIN.
   - Únicamente se registra el método de pago (`TARJETA_POS`, `TRANSFERENCIA`, `QR`), los últimos 4 dígitos opcionales para conciliación y el número de referencia del comprobante del procesador (Bancard, Dinelco, etc.).
2. **Control de Arqueo y Cierre de Caja**:
   - Cada movimiento de dinero está vinculado a un `cash_register_id` abierto y a un `user_id` responsable.
   - El cierre de caja registra de manera inmutable el monto esperado, el monto real contado y la diferencia para auditoría interna.

---

## 5. AUDITORÍA INMUTABLE Y TRAZABILIDAD (AUDIT TRAIL)

Toda acción crítica genera un registro en la tabla `audit_logs`:
- **Acciones Auditadas**:
  - Inicios de sesión (`LOGIN_SUCCESS`, `LOGIN_FAILED`).
  - Creación y edición de pacientes (`PATIENT_CREATED`, `PATIENT_UPDATED`).
  - Acceso a historias clínicas (`CLINICAL_RECORD_VIEWED`, `CLINICAL_RECORD_CREATED`).
  - Cobros y movimientos de caja (`PAYMENT_RECEIVED`, `CASH_DRAWER_OPENED`, `CASH_DRAWER_CLOSED`).
  - Modificaciones en permisos o creación de usuarios (`USER_CREATED`, `ROLE_MODIFIED`).
- **Garantía**: Los registros de auditoría no admiten `UPDATE` ni `DELETE` (Append-Only).

---

## 6. PREVENCIÓN CONTRA OWASP TOP 10

| Amenaza | Vector | Mitigación Implementada |
| :--- | :--- | :--- |
| **SQL Injection** | Entrada de datos maliciosos en consultas | Uso exclusivo de Drizzle ORM / consultas preparadas parametrizadas en PostgreSQL. Prohibida la concatenación directa de cadenas SQL. |
| **Cross-Site Scripting (XSS)** | Inyección de scripts en notas de pacientes o motivos | Sanitización automática con React JSX + validación estricta de esquemas Zod en todas las entradas de texto. |
| **Cross-Site Request Forgery (CSRF)** | Peticiones no autorizadas enviadas desde sitios maliciosos | Cookies de sesión `SameSite=Lax` + validación de headers de origen `Origin` y `Referer` en Server Actions. |
| **Mass Assignment** | Parámetros ocultos inyectados en formularios | Uso estricto de DTOs validados con Zod, descartando cualquier propiedad no declarada explícitamente en el esquema. |
| **Broken Access Control** | Modificación de roles o acceso a otra sucursal | Validación multinivel en servidor (Middleware -> Service Layer -> Database Query). |
