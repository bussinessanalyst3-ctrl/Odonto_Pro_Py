# DOCUMENTO DE ARQUITECTURA TÉCNICA (ARCHITECTURE.md)
## Sistema Web para Clínica Odontológica en Paraguay
### Arquitectura Multi-Tenant y Multi-Sucursal para Alta Concurrencia y Bajo Costo

---

## 1. VISIÓN GENERAL Y ARQUITECTURA DEL SISTEMA

El sistema está diseñado bajo el principio rector: **"Simple para comenzar, sólido para crecer"**.
Permite operar desde una clínica con un solo consultorio y una sucursal, hasta redes de franquicias médicas u organizaciones odontológicas con decenas de sucursales distribuidas por todo Paraguay y la región, con posibilidad de convertirse en una plataforma SaaS odontológica sin requerir reingeniería estructural.

### Flujo Conceptual de Entornos e Infraestructura

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                GOOGLE AI STUDIO (Desarrollo)                │
 │         Desarrollo asistido, pruebas y prototipado          │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Push a ramas protegidas (PR / Code Review)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                     GITHUB REPOSITORY                       │
 │  Control de versiones, CI/CD (GitHub Actions), Lint & Tests │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Despliegue automático
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                  VERCEL CLOUD PLATFORM                      │
 │     Edge Network + Next.js App Router (SSR / API / RSC)     │
 │        Entornos: Development / Preview / Production         │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Conexión segura TLS con Pooling
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │            POSTGRESQL DATABASE (Supabase / Neon)            │
 │     Base de datos relacional con RLS, UUIDv4 y Pooling      │
 └──────────────────────────────┬──────────────────────────────┘
                                │
   ┌────────────────────────────┼────────────────────────────┐
   │                            │                            │
   ▼                            ▼                            ▼
ORGANIZACIÓN A           ORGANIZACIÓN B               ORGANIZACIÓN C
(Clínica OdontoSol)      (Red Dental Asunción)        (Centro San Lorenzo)
   │                            │                            │
 ┌─┴─┐                        ┌─┴─┐                        ┌─┴─┐
Suc1 Suc2                    Suc1 Suc2 Suc3               Suc1
```

---

## 2. STACK TECNOLÓGICO RECOMENDADO

| Capa | Tecnología | Justificación Técnica |
| :--- | :--- | :--- |
| **Framework Principal** | **Next.js 15+ / React 19** con TypeScript | Soporte unificado de Frontend y Backend (Route Handlers / Server Actions). Cero latencia cliente-servidor para validaciones de seguridad. Excelente compatibilidad nativa con Vercel. |
| **Lenguaje** | **TypeScript 5+ (Strict Mode)** | Tipado estático riguroso para entidades médicas, transacciones financieras en Guaraníes (PYG) y permisos RBAC. |
| **Base de Datos** | **PostgreSQL 16+ (Neon Serverless / Supabase)** | Base de datos relacional estándar, soporte para JSONB (odontograma, metadatos), Row Level Security (RLS) y escalado a cero (gratuito o costo ultrabajo en etapas iniciales). |
| **ORM / Acceso a Datos** | **Drizzle ORM** (o Prisma) | Tipado integral TypeScript de extremo a extremo, cero sobrecarga en tiempo de ejecución, migraciones SQL reproducibles y consultas optimizadas sin N+1. |
| **Autenticación** | **Auth.js (NextAuth v5) o Supabase Auth / JWT HttpOnly** | Sesiones seguras en cookies `HttpOnly`, `SameSite=Lax`, `Secure`, sin exposición de tokens en `localStorage`. |
| **Estilos & UI** | **Tailwind CSS v4 + Radix UI + Lucide Icons** | Diseño clínico limpio, Mobile-First, accesible (WCAG AA), alto contraste y rendimiento sin bundle excesivo. |
| **Animaciones UI** | **Motion (`motion/react`)** | Transiciones sutiles en cambios de agenda, odontograma interactivo y modales de atención. |
| **Validación de Schemas** | **Zod** | Validación isomórfica (backend y frontend) para formularios de pacientes, citas y transacciones en moneda local. |
| **Fechas y Horarios** | **date-fns-tz** | Gestión estricta de la zona horaria `America/Asuncion` para evitar problemas con cambios de horario de verano/invierno en Paraguay. |

---

## 3. ESTRUCTURA MODULAR DE CARPETAS

La estructura respeta la separación de responsabilidades, seguridad por defecto y mantenibilidad:

```text
├── .github/
│   └── workflows/
│       ├── ci.yml               # Verificación de tipos, linter y tests
│       └── preview.yml          # Chequeo de despliegues en Vercel
├── docs/                        # Documentación técnica extendida
├── src/
│   ├── app/                     # Next.js App Router (Rutas y Páginas)
│   │   ├── (auth)/              # Grupo de rutas públicas (Login, Recuperar contraseña)
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/         # Grupo de rutas protegidas de la aplicación
│   │   │   ├── layout.tsx       # Sidebar, Topbar con Selector de Sucursal y Perfil
│   │   │   ├── page.tsx         # Dashboard adaptativo según rol del usuario
│   │   │   ├── pacientes/       # Módulo de Pacientes
│   │   │   │   ├── page.tsx
│   │   │   │   ├── nuevo/
│   │   │   │   └── [id]/        # Ficha del paciente e Historia Clínica
│   │   │   ├── agenda/          # Módulo de Citas y Turnos por Sucursal
│   │   │   ├── tratamientos/    # Odontograma y Procedimientos
│   │   │   ├── presupuestos/    # Emisión de Presupuestos en PYG
│   │   │   ├── caja/            # Apertura, Movimientos y Cierre de Caja
│   │   │   ├── reportes/        # Estadísticas e Ingresos
│   │   │   └── configuracion/   # Ajustes de Organización, Sucursales y Usuarios
│   │   └── api/                 # Endpoints REST internos protegidos
│   │       ├── auth/
│   │       ├── branches/
│   │       ├── appointments/
│   │       └── odontogram/
│   ├── components/              # Componentes reutilizables UI
│   │   ├── ui/                  # Botones, Modales, Inputs, Tablas, Badges
│   │   ├── layout/              # Sidebar, Header, BranchSelector
│   │   ├── odontogram/          # Odontograma interactivo SVG
│   │   └── common/              # Formatters de moneda (PYG), fechas, etc.
│   ├── db/                      # Capa de Base de Datos
│   │   ├── schema/              # Definiciones Drizzle / Tablas
│   │   │   ├── organizations.ts
│   │   │   ├── branches.ts
│   │   │   ├── users.ts
│   │   │   ├── patients.ts
│   │   │   ├── clinical.ts
│   │   │   └── financial.ts
│   │   ├── migrations/          # Archivos SQL generados
│   │   └── index.ts             # Cliente de conexión con connection pooler
│   ├── lib/                     # Utilidades y configuración central
│   │   ├── auth.ts              # Configuración de sesiones y tokens
│   │   ├── permissions.ts       # Definición de RBAC y evaluador de permisos
│   │   ├── paraguay.ts          # Constantes regionales (Departamentos, Ciudades, PYG)
│   │   ├── formatters.ts        # Formateo de Guaraníes, CI y teléfonos
│   │   └── audit.ts             # Motor de registro de auditoría
│   ├── services/                # Lógica de Negocio aislada (Backend)
│   │   ├── patientService.ts
│   │   ├── appointmentService.ts
│   │   ├── cashRegisterService.ts
│   │   └── auditService.ts
│   └── types/                   # Definiciones TypeScript compartidas
│       ├── index.ts
│       ├── roles.ts
│       └── odontogram.ts
├── ARCHITECTURE.md
├── DATABASE.md
├── SECURITY.md
├── ROADMAP.md
├── README.md
├── .env.example
└── .gitignore
```

---

## 4. MODELO DE TENENCIA: MULTI-TENANT Y MULTI-SUCURSAL

### 4.1 Estrategia de Multi-Tenancy: Shared Database, Shared Schema con Row-Level Isolation

Para optimizar costos, mantenimiento y permitir una migración fluida a SaaS:
1. **Identificador del Tenant**: Toda tabla operativa contiene `organization_id UUID NOT NULL REFERENCES organizations(id)`.
2. **Contexto de Ubicación**: Las transacciones físicas (citas, cajas, sillones odontológicos) contienen `branch_id UUID REFERENCES branches(id)`.
3. **Restricción Forzada en Capa de Datos y Backend**:
   - En cada consulta, la cláusula `WHERE organization_id = :sessionOrgId` es inyectada mandatoriamente mediante helpers del ORM o políticas RLS en PostgreSQL.
   - Ninguna llamada al servicio puede recibir un `organization_id` del cuerpo de la petición (evita Parameter Tampering). Siempre se toma del contexto de la sesión validada.

### 4.2 Modelo Pacientes y Sucursales: Historia Clínica Compartida dentro de la Organización

Un paciente puede pertenecer inicialmente a una sucursal base, pero si asiste a otra sucursal de la misma clínica (ejemplo: urgencia o tratamiento especializado con ortodoncista), **no se duplica el paciente**.
- La ficha del paciente (`patients`) pertenece a la `organization_id`.
- La tabla intermedia `patient_branches` registra las sucursales donde el paciente ha recibido atención o está registrado.
- Cada entrada en la historia clínica (`clinical_records`) almacena el `branch_id` exacto donde se realizó la atención y el `odontologist_id` que intervino.

```text
                  ┌──────────────┐
                  │ Organización │
                  └──────┬───────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   ┌──────────────┐              ┌──────────────┐
   │  Sucursal 1  │              │  Sucursal 2  │
   └──────┬───────┘              └──────┬───────┘
          │                             │
          │    ┌──────────────────┐     │
          └───►│ Paciente Único   │◄────┘
               │ (CI / RUC / Pas) │
               └────────┬─────────┘
                        │
                        ▼
               ┌──────────────────┐
               │ Historia Clínica │
               │ (Eventos Suc. 1  │
               │  y Eventos Suc. 2│
               │  unificados)     │
               └──────────────────┘
```

---

## 5. SISTEMA DE AUTENTICACIÓN Y AUTORIZACIÓN (RBAC CONTEXTUAL)

### 5.1 Autenticación Segura
- **Almacenamiento de Credenciales**: Hash con `Argon2id` o `bcrypt` (factor de costo 12+).
- **Transporte de Sesión**: Cookie cifrada `HttpOnly`, con banderas `SameSite=Lax`, `Secure` y expiración a las 8 horas de inactividad.
- **Protección contra Brute-Force**: Bloqueo temporal de cuenta tras 5 intentos fallidos consecutivos por IP y por correo.

### 5.2 Matriz de Roles Inicial

| Rol | Ámbito | Permisos Principales |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Toda la Organización | Gestión de todas las sucursales, creación de usuarios, configuración fiscal, catálogo general de servicios y reportes globales consolidados. |
| **ADMIN_SUCURSAL** | 1 o varias sucursales asignadas | Configuración de horarios de sucursal, gestión de personal local, control de cajas locales y reportes de la sucursal. |
| **ODONTÓLOGO** | Sucursales asignadas | Agenda propia, consulta y registro en historia clínica, diagnóstico, odontograma, plan de tratamiento y notas clínicas. |
| **RECEPCIÓN** | Sucursal en turno | Gestión de citas, registro y actualización de datos demográficos de pacientes, confirmación de turnos por WhatsApp y check-in de sala de espera. |
| **CAJA** | Sucursal en turno | Apertura de caja, cobro de tratamientos en PYG (efectivo, POS, transferencia, QR), emisión de recibos y cierre de caja diario con arqueo. |

### 5.3 Regla Crítica de Verificación en Cada Solicitud (Anti-IDOR)

El middleware y los Route Handlers ejecutan la cadena de validación:
```text
Request Recibida
       │
       ▼
1. ¿Existe sesión válida y activa? ──► [NO] ──► 401 Unauthorized
       │
       ▼
2. ¿El usuario pertenece a session.organization_id? ──► [NO] ──► 403 Forbidden
       │
       ▼
3. ¿El recurso solicitado pertenece a session.organization_id? ──► [NO] ──► 404 Not Found (Ocultar existencia)
       │
       ▼
4. Si el recurso está limitado por sucursal:
   ¿El usuario tiene acceso a dicho branch_id o es SUPER_ADMIN? ──► [NO] ──► 403 Forbidden
       │
       ▼
5. ¿El rol del usuario cuenta con el permiso requerido para la acción? ──► [NO] ──► 403 Forbidden
       │
       ▼
Acción Autorizada y Registrada en Audit Log
```

---

## 6. CONFIGURACIÓN REGIONAL DE PARAGUAY

### 6.1 Moneda y Formato Financiero
- **Moneda Primaria**: Guaraní (`PYG`, símbolo `₲`).
- **Naturaleza Matemática**: El Guaraní no utiliza centavos en la práctica comercial habitual. Las columnas de base de datos se almacenan como `BIGINT` (o `NUMERIC(14,0)`) para evitar errores de precisión de punto flotante.
- **Formateo de Salida**: `₲ 150.000` (puntos como separadores de miles).

### 6.2 Documentos de Identidad
- **Cédula de Identidad Civil (CI)**: Numérica (e.g. `4.567.890`).
- **RUC**: Con dígito verificador para facturación (e.g. `80012345-6`).
- **Pasaporte / Documento Extranjero**: Alfanumérico para pacientes no residentes.
- **Restricción de Unicidad**: `UNIQUE(organization_id, document_type, document_number)`.

### 6.3 Catálogo Geográfico Inicial de Paraguay
El sistema precarga los 17 departamentos más la capital Asunción:
- `Asunción (Distrito Capital)`
- `Central` (San Lorenzo, Luque, Fernando de la Mora, Lambaré, Capiatá, etc.)
- `Alto Paraná` (Ciudad del Este, Hernandarias, Presidente Franco, etc.)
- `Itapúa` (Encarnación, Cambyretá, etc.)
- `Caaguazú`, `Cordillera`, `Guairá`, `Concepción`, `San Pedro`, etc.

### 6.4 Teléfonos y WhatsApp
- Almacenamiento en estándar internacional: `+595981123456`.
- Enlaces automáticos a WhatsApp Web / API con mensajes preconfigurados de confirmación de turnos odontológicos.

---

## 7. ESTRATEGIA GITHUB Y VERCEL

### 7.1 Estrategia en GitHub
- **Estructura de Ramas**:
  - `main`: Código de producción desplegado automáticamente a Vercel Production.
  - `staging` / `develop`: Integración de fases completadas desplegadas en Vercel Preview.
  - `feature/fase-X-nombre`: Ramas de trabajo para cada módulo del roadmap.
- **Protección de Ramas**: Requerir paso de CI (TypeScript check, linting y tests) antes de mergear a `main`.

### 7.2 Estrategia en Vercel
- **Ambientes de Vercel**:
  - **Development**: Ejecución local con variables `.env.local` conectadas a base de datos de desarrollo.
  - **Preview**: Despliegue de cada Pull Request en rama aislada con base de datos de staging.
  - **Production**: Dominio de la clínica con optimización de assets, Edge Caching para catálogos y pooling transaccional a la base de datos de producción.

---

## 9. ECOSISTEMA INTEGRADO: "SINGLE SOURCE OF TRUTH" Y FLUJOS CONECTADOS

El sistema opera bajo la regla de oro: **"Registrar la información una sola vez por identificador (ID) y reutilizarla en todos los módulos"**. Se erradica por completo la duplicación de datos o la reescritura manual entre áreas clínicas y administrativas.

### 9.1 Matriz de Fuente de Verdad

```text
                  PACIENTE (patients: id, ci, nombre)
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       AGENDA    ODONTOGRAMA  HISTORIA
                     │
            (Diagnóstico x Pieza)
                     │
                     ▼
                 PRESUPUESTO (budgets: total, saldo, progreso)
                     │
             ┌───────┴───────┐
             ▼ (Al aprobar)  ▼ (Al cobrar)
        TRATAMIENTO         RECIBO (receipts: RC-XXXXXX)
             │               │
             ▼ (Finalizar)   ▼ (Autocreación 1:1)
        ODONTOGRAMA      MOVIMIENTO CAJA (cash_movements: MOV-XXXXXX)
                             │
                             ▼
                            CAJA (Arqueo x Sucursal)
                             │
                             ▼
                          REPORTES / DASHBOARD
```

| Entidad | Fuente de Verdad | Referencia en Módulos Consumidores | Regla de Oro |
| :--- | :--- | :--- | :--- |
| **Identidad Paciente** | `patients` | `patient_id` en Citas, Odontograma, Presupuestos, Recibos | Nunca duplicar C.I., nombres o teléfono como texto suelto. |
| **Hallazgo Dental Inicial** | `odontogram_items` | `tooth_number`, `surface`, `condition` | El diagnóstico en la pieza 16 alimenta el presupuesto. |
| **Presupuesto y Condiciones** | `budgets` / `budget_items` | `budget_id`, `budget_item_id` | Al aprobarse, genera la orden clínica de tratamiento. |
| **Ejecución Técnica** | `treatments` | `treatment_id` en Citas y Odontograma | Al marcarse `FINALIZADO`, actualiza el color del diente y el % del presupuesto. |
| **Comprobante y Cobro** | `receipts` / `payments` | `receipt_id`, `cash_movement_id` | Al emitirse, genera en una transacción atómica el ingreso a caja física. |

### 9.2 Estrategia de Correlativos Multi-Sucursal Segura

Para cumplir con regulaciones administrativas y tributarias en Paraguay sin colisiones concurrentes (*race conditions*):
* **Estructura:** `[SUCURSAL]-[TIPO_DOC]-[SECUENCIA_6_DIGITOS]`
  * Ejemplo Asunción: `ASU-PRES-000001`, `ASU-RC-000001`, `ASU-MOV-000001`
  * Ejemplo Luque: `LUQ-PRES-000001`, `LUQ-RC-000001`, `LUQ-MOV-000001`
* **Concurrencia Segura:** La tabla `document_sequences` utiliza bloqueos a nivel de fila (`SELECT ... FOR UPDATE`), garantizando unicidad estricta ante múltiples recepciones emitiendo cobros simultáneos.
