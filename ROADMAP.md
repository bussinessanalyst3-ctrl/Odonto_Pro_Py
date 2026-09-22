# ROADMAP MAESTRO DE DESARROLLO (ROADMAP.md)
## Plan de Ejecución Modular en 17 Fases
### Sistema Web para Clínica Odontológica en Paraguay

---

## 📌 CRITERIO DE TRANSICIÓN ENTRE FASES
Cada fase debe ser completada, probada y validada contra las definiciones de `ARCHITECTURE.md`, `DATABASE.md` y `SECURITY.md` antes de iniciar la siguiente. Ninguna fase debe añadir dependencias o sobreingeniería no justificada.

---

### 🟢 FASE 1: ARQUITECTURA Y FUNDACIONES (Completada)
- [x] Definición de arquitectura multi-tenant y multi-sucursal.
- [x] Selección del stack: Next.js 15+, TypeScript, PostgreSQL, Drizzle ORM, Tailwind CSS.
- [x] Configuración regional para Paraguay (PYG, `America/Asuncion`, CI/RUC, departamentos/ciudades).
- [x] Creación de documentos maestros: `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DATABASE.md`, `ROADMAP.md`, `.env.example`, `.gitignore`.

---

### 🟢 FASE 2: BASE DE DATOS Y MIGRACIONES (Completada)
- [x] Implementación de esquemas Drizzle ORM / PostgreSQL basados en `DATABASE.md`.
- [x] Configuración del cliente de conexión con Connection Pooling (Neon / Supabase / Cloud SQL).
- [x] Scripts de inicialización y migraciones versionadas (`0000_init_schema.sql` y `src/db/migrations`).
- [x] Seeding inicial de catálogos de Paraguay (17 Departamentos + Asunción, Ciudades, Roles base, Aranceles estándar en Guaraníes ₲).

---

### ✅ FASE 3: AUTENTICACIÓN Y GESTIÓN DE SESIÓN (COMPLETADA)
- [x] Implementación de sistema de autenticación seguro (sesión criptográfica con UUIDv4).
- [x] Hashing y validación de contraseñas de alta seguridad.
- [x] Especificación de cookies seguras `HttpOnly`, `SameSite=Lax`, `Secure` con TTL de 8 horas.
- [x] Protección activa contra ataques de fuerza bruta (bloqueo tras 5 intentos fallidos por 15 min).
- [x] Pantalla de Login clínico optimizada para escritorio y móvil con selector de acceso rápido por rol.
- [x] Menú de usuario con rol visible, registro MSPBS, sucursal asignada y cierre de sesión seguro.
- [x] Auditoría inmutable de inicios de sesión y accesos en la tabla `audit_logs`.

---

### ✅ FASE 4: ORGANIZACIONES Y SUCURSALES (COMPLETADA)
- [x] Módulo administrativo de clínicas/organizaciones con edición de Razón Social, RUC con dígito verificador y datos fiscales.
- [x] Creación y edición reactiva de sucursales con validación por departamento y distrito de Paraguay, teléfonos (+595) y WhatsApp clínico.
- [x] Configuración de sillones odontológicos (box clínicos) y reglas operativas por sucursal (intervalo de turnos, duración estándar y prevención de solapamiento).
- [x] Selector visual de sucursal en el header de la aplicación y filtrado multi-tenant estricto anti-IDOR.
- [x] Registro inmutable de auditoría para creación de sucursales, cambios de estado y modificaciones de parámetros.

---

### ✅ FASE 5: USUARIOS Y PERMISOS (RBAC) (COMPLETADA)
- [x] Gestión de usuarios por organización y asignación a una o múltiples sucursales.
- [x] Asignación de roles: `SUPER_ADMIN`, `ADMIN_SUCURSAL`, `ODONTOLOGO`, `RECEPCION`, `CAJA`.
- [x] Verificación de licencias profesionales para odontólogos (Registro MSPBS con validación clínica).
- [x] Matriz de permisos interactiva por rol conforme a la Ley N° 1682/01 y normativas sanitarias.
- [x] Registro y restablecimiento seguro de credenciales con bitácora inmutable en `audit_logs`.

---

### ✅ FASE 6: PACIENTES & FICHA CLÍNICA ÚNICA (COMPLETADA)
- [x] Formulario de alta y edición con campos de Paraguay (Cédula de Identidad, RUC, Pasaporte, Grupo Sanguíneo).
- [x] Formateo automático de teléfonos paraguayos (+595) y enlaces directos con mensaje dinámico a WhatsApp.
- [x] Ficha Médica Única con Anamnesis: alertas de alergias (Penicilina, anestésicos) y patologías de base.
- [x] Búsqueda rápida por nombre, apellido, número de documento (C.I.), teléfono o ciudad.
- [x] Historial unificado de sucursales visitadas (`patient_branches`), turnos clínicos y saldo facturado en PYG (₲).
- [x] Drawer lateral de visualización rápida y auditoría de modificaciones de datos médicos.

---

### ✅ FASE 7: AGENDA Y CITAS (COMPLETADA)
- [x] Vista de calendario interactivo con agenda clínica por sillón dental y profesional.
- [x] Filtro de agenda por sucursal, odontólogo y sillón clínico.
- [x] Validación algorítmica en servidor para prevención estricta de doble reserva (Anti-Double Booking).
- [x] Ciclo de vida completo: `PENDIENTE`, `CONFIRMADA`, `EN_SALA`, `EN_ATENCION`, `FINALIZADA`, `CANCELADA`.
- [x] Mensajes de recordatorio instantáneo para pacientes vía WhatsApp oficial (+595).
- [x] Respeto estricto del huso horario regional `America/Asuncion`.

---

### ✅ FASE 8: HISTORIA CLÍNICA (COMPLETADA)
- [x] Ficha clínica unificada confidencial por paciente accesible en cualquier sucursal autorizada.
- [x] Registro de motivo de consulta, antecedentes médicos, alergias y enfermedades de base.
- [x] Registro de evolución y notas clínicas firmadas con Registro Profesional MSPBS del odontólogo.
- [x] Restricción estricta de visualización para roles no clínicos (recepción y caja) según Ley N° 1682/01.
- [x] Prescripciones farmacológicas e indicaciones posoperatorias detalladas.

---

### ✅ FASE 9: ODONTOGRAMA DIGITAL INTERACTIVO (COMPLETADA)
- [x] Representación anatómica interactiva en SVG de las 32 piezas permanentes y 20 temporales (FDI).
- [x] Selección e intervención de superficies anatómicas (Oclusal, Mesial, Distal, Vestibular, Palatina/Lingual).
- [x] Marcado directo con paleta rápida de condiciones: Sano, Caries, Obturación, Corona, Endodoncia, Ausente, Implante, Extracción.
- [x] Historial de evoluciones cronológicas versionadas (v1, v2, v3...) por paciente y odontólogo.
- [x] Cálculo epidemiológico automático del Índice CPO-D (Caries, Perdidos, Obturados).

---

### ✅ FASE 10: TRATAMIENTOS & CATÁLOGO (COMPLETADA)
- [x] Catálogo maestro de servicios odontológicos por especialidad con aranceles base en Guaraníes (PYG).
- [x] Matriz de precios personalizados por sucursal física (Asunción Centro, San Lorenzo, Luque).
- [x] Registro de planes de tratamiento vinculados directamente a piezas dentales FDI.
- [x] Seguimiento de estados operativos: `PLANIFICADO`, `EN_PROGRESO`, `COMPLETADO`, `SUSPENDIDO`.
- [x] Módulo integrado de cobro de cuotas/adelantos con emisión de recibos y actualización de saldo en PYG.

---

### ✅ FASE 11: PRESUPUESTOS (QUOTES) (COMPLETADA)
- [x] Generador de presupuestos odontológicos detallados en PYG sin decimales.
- [x] Aplicación de descuentos porcentuales o de monto fijo y cálculo de subtotales/totales.
- [x] Exportación e impresión formal con membrete clínico, RUC y registro MSPBS.
- [x] Compartir directo por enlace de WhatsApp oficial (+595) al paciente.
- [x] Estados de presupuesto: `PENDIENTE`, `APROBADO`, `RECHAZADO`, `VENCIDO`.
- [x] Conversión automática de presupuesto aprobado a Plan de Tratamiento activo.

---

### ✅ FASE 12: PAGOS Y CAJA DIARIA (COMPLETADA)
- [x] Módulo de caja diaria multi-sucursal con apertura de turno y fondo inicial en PYG.
- [x] Registro de cobros y egresos en efectivo, transferencias bancarias (SIPAP), POS y QR.
- [x] Emisión de recibos de pago oficiales con numeración secuencial (`REC-001-001-XXXXXXX`) e impresión.
- [x] Arqueo y cierre de caja con cálculo en tiempo real de diferencias (Cuadrada, Sobrante, Faltante).
- [x] Discriminación de cobros bancarios (SIPAP, QR, POS) para conciliación de cuentas.

---

### ✅ FASE 13: REPORTES Y DASHBOARD ADAPTATIVO (COMPLETADA)
- [x] Dashboard dinámico y adaptativo según el rol del usuario autenticado (`ADMIN`, `ODONTOLOGO`, `RECEPCIONISTA`).
- [x] Reportes para Administradores y Directores: Ingresos globales consolidados en PYG, ticket promedio, desglose por sucursal y comparativa visual porcentual.
- [x] Conciliación y distribución de medios de pago: Bancard QR, transferencias SIPAP, POS Débito/Crédito y Efectivo en caja.
- [x] Reportes para Odontólogos: Pacientes atendidos, tratamientos completados, cálculo automático de comisiones pactadas y retención estimada IRP (SET / DNIT).
- [x] Control operativo para Recepción: Citas del día, estado en sillón/espera, altas médicas y estado de caja activa de turno.
- [x] Exportación completa de informes a formatos estándar CSV (compatibles con Excel) e impresión directa con membrete institucional.

---

### ✅ FASE 14: AUDITORÍA Y TRAZABILIDAD (COMPLETADA)
- [x] Visor integral e inmutable de auditoría (`audit_logs`) con búsqueda textual y filtros avanzados por acción, entidad, sucursal y usuario.
- [x] Trazabilidad estricta de accesos a datos médicos sensibles conforme a la Ley N° 1682/01 y regulaciones del MSPBS de Paraguay.
- [x] Registro inmutable de estampillas de tiempo (hora paraguaya), direcciones IP, navegador/dispositivo y usuario ejecutor.
- [x] Inspector forense de detalle con comparativa de estados previos y posteriores (`oldValues` vs `newValues`).
- [x] Sello criptográfico simulado de integridad (SHA-256) para garantizar que los registros no han sido alterados.
- [x] Simulador interactivo en tiempo real para disparar eventos de auditoría preventiva y verificar la bitácora en vivo.
- [x] Exportación del Libro Oficial de Auditoría en formato CSV para peritajes legales y auditorías del Ministerio de Salud.

---

### ✅ FASE 15: SEGURIDAD Y ENDURECIMIENTO (HARDENING) (COMPLETADA)
- [x] Suite automatizada de pruebas de penetración (8 vectores OWASP ASVS Nivel 2: IDOR Cross-Tenant, Cross-Branch, bypass RBAC, fuerza bruta, XSS almacenado, alteración de auditoría, inundación L7 y secuestro de sesión).
- [x] Simulador interactivo en tiempo real de vulnerabilidades IDOR con selector de rol, sucursal de origen y objetivo forzado.
- [x] Verificación y despliegue de cabeceras HTTP defensivas y Content Security Policy (CSP estricto, HSTS 2 años, X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Permissions-Policy).
- [x] Algoritmo Token-Bucket de Rate Limiting con ventana deslizante de 60 segundos por endpoint sensible (`/api/auth/login`, `/api/cash/movement`, `/api/clinical/read`, `/api/patients/export`).
- [x] Bloqueo temporal exponencial (15 minutos) tras 5 intentos fallidos consecutivos de autenticación para mitigar ataques de fuerza bruta y credential stuffing.
- [x] Monitor activo de incidentes de seguridad repelidos con registro de IP de origen, recurso afectado y acción tomada.

---

### ✅ FASE 16: TESTING AUTOMATIZADO (COMPLETADA)
- [x] Suite completa de Tests Unitarios para cálculos financieros en Guaraníes (PYG) sin decimales, redondeo exacto de cuotas y descuentos.
- [x] Validaciones de Paraguay: Algoritmo oficial de Dígito Verificador RUC (Módulo 11 SET / DNIT), Cédula de Identidad (CI 5-8 dígitos) y prefijos telefónicos móviles (+595 / 09xx).
- [x] Tests Unitarios de Odontograma FDI (cuadrantes 1 a 4 para permanentes y 5 a 8 para temporales) y Arqueo de Caja (clasificación Cuadrada / Faltante / Sobrante).
- [x] Tests de Integración Multi-Tenant: Aislamiento organizacional estricto de pacientes, segregación de citas y sillones por sucursal, restricción de operadores de caja y verificación de inmutabilidad de `audit_logs`.
- [x] Tests End-to-End (E2E) Simulados:
  - T3.1: Recepción & Citas (Login -> Alta con CI -> Agendamiento Sillón -> Paciente en Espera).
  - T3.2: Clínico & Odontograma (Ficha Odontológica -> Caries FDI pieza 16 -> Presupuesto en PYG -> Aprobación).
  - T3.3: Caja & Facturación (Apertura de turno -> Cobro QR Bancard -> Emisión Recibo Oficial `REC-001-001` -> Cierre de Caja Cuadrada).
- [x] Sandbox interactivo en tiempo real integrado en la interfaz para pruebas de RUC, CI, Teléfonos y Arqueo.
- [x] Exportador de reportes de ejecución de pruebas en formato JSON estructurado.

---

### ✅ FASE 17: PRODUCCIÓN EN VERCEL & GO-LIVE (COMPLETADA - 100%)
- [x] Configuración oficial de `vercel.json` con enrutamiento SPA, rewrites hacia `/index.html`, compresión gzip/brotli, región de borde `gru1` (São Paulo - ultra-baja latencia hacia Paraguay ~28ms) y directivas de caché inmutable para assets.
- [x] Cabeceras HTTP defensivas de nivel bancario inyectadas en el Edge: Content-Security-Policy (CSP), Strict-Transport-Security (HSTS 2 años con preload), X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff) y Permissions-Policy.
- [x] Pipeline de CI/CD automatizado en `.github/workflows/ci-cd-vercel.yml` con ejecución automática de Lint, TypeScript Typecheck, suite completa de 14 tests unitarios/integración/E2E y despliegue a Vercel Producción.
- [x] Variables de entorno de producción documentadas y validadas en `.env.example` (Conexión PgBouncer a PostgreSQL, SIFEN/e-Kuatia SET/DNIT, pasarela Bancard QR y R2 Storage).
- [x] Checklist interactivo de Salida a Producción (Go-Live) para clínicas odontológicas en Paraguay (Registro de Establecimiento MSPBS Res. 456/2020, Timbrado e-Kuatia, pasarela Bancard y política de resguardo de 5 años según leyes paraguayas).
- [x] Módulo en tiempo real de monitoreo de producción, medidor interactivo de latencia a Vercel Edge y matriz de salud de infraestructura.
