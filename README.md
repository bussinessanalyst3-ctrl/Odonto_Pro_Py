# SISTEMA WEB PARA CLÍNICA ODONTOLÓGICA EN PARAGUAY
## Arquitectura Multi-Tenant y Multi-Sucursal (Fase 1)

Sistema integral de gestión para clínicas y consultorios odontológicos diseñado específicamente para el contexto normativo, geográfico y financiero de **Paraguay**, estructurado sobre una arquitectura escalable capaz de operar desde un consultorio individual hasta redes nacionales de policlínicas con múltiples sucursales o franquicias SaaS.

---

## 🎯 Estado del Proyecto: FASE 1 — ARQUITECTURA

Este repositorio contiene la definición arquitectónica, modelo de datos relacional, matriz de seguridad y especificaciones de despliegue antes de proceder a la fase de codificación de módulos de negocio.

### Documentación Central:
- 📐 **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**: Arquitectura general de capas, multi-tenancy, multi-sucursal, stack tecnológico y flujo de datos.
- 🗄️ **[`DATABASE.md`](./DATABASE.md)**: Modelo relacional completo en PostgreSQL (DDL, llaves foráneas, índices, restricciones y aislamiento).
- 🛡️ **[`SECURITY.md`](./SECURITY.md)**: Estrategia de seguridad, protección contra IDOR, RBAC contextual, auditoría y protección de datos médicos sensibles.
- 🗺️ **[`ROADMAP.md`](./ROADMAP.md)**: Plan maestro de implementación estructurado en 17 fases incrementales.
- ⚙️ **[`.env.example`](./.env.example)**: Variables de entorno requeridas para desarrollo, preview y producción.

---

## 🇵🇾 Contexto Específico: Paraguay

| Parámetro | Configuración Inicial |
| :--- | :--- |
| **País** | Paraguay (`PY` / `PRY` / ISO 3166-1) |
| **Moneda** | Guaraní Paraguayo (`PYG` / `₲`) — Formateo con separador de miles por punto (`₲ 150.000`) |
| **Zona Horaria** | `America/Asuncion` (UTC-4 estándar / UTC-3 horario de verano) |
| **Documentos** | Cédula de Identidad (`CI`), `RUC`, `Pasaporte`, `Otro` |
| **Teléfonos** | Prefijo internacional `+595` con validación de operadoras locales (`0981`, `0971`, etc.) |
| **Geografía** | Catálogo normalizado de Departamentos (Asunción, Central, Alto Paraná, Itapúa, etc.), Ciudades y Barrios |
| **Idioma** | Español (`es-PY`) con arquitectura i18n lista para expansión regional |

---

## 🏛️ Principio Arquitectónico

```text
ORGANIZACIÓN / CLÍNICA (Tenant)
        │
        ├── SUCURSAL 1 (e.g. Asunción Centro)
        │     ├── Cajas & Facturación
        │     ├── Citas & Agenda
        │     ├── Sillones Odontológicos
        │     └── Catálogo de Precios por Sucursal
        │
        ├── SUCURSAL 2 (e.g. San Lorenzo)
        │     ├── Cajas & Facturación
        │     ├── Citas & Agenda
        │     └── Catálogo de Precios por Sucursal
        │
        └── PACIENTE COMPARTIDO (Historia Clínica Unificada a nivel Organización)
              ├── Consulta Sucursal 1 (Odontólogo A)
              └── Tratamiento Sucursal 2 (Odontólogo B)
```

1. **Aislamiento Multi-Tenant**: Toda consulta está obligada a filtrar por `organization_id`.
2. **Contexto Operativo Multi-Sucursal**: Las transacciones financieras, citas y agendas están vinculadas a `branch_id`.
3. **Historia Clínica Continua**: El paciente no se duplica si asiste a distintas sucursales de la misma organización clínica.

---

## 💻 Stack Tecnológico Seleccionado

- **Frontend & Backend**: Next.js 15+ / React 19 (App Router, Server Actions, Server Components & Route Handlers) + TypeScript.
- **Base de Datos**: PostgreSQL 16+ (Supabase / Neon / Cloud SQL) con soporte de UUIDv4, Row-Level Security (RLS) y pooling transaccional.
- **ORM / Query Builder**: Drizzle ORM o Prisma con migraciones versionadas.
- **Estilos & UI**: Tailwind CSS v4 + Lucide Icons + Radix UI + Motion.
- **Despliegue & CI/CD**: GitHub Actions + Vercel (Environments: Development, Preview, Production).

---

## 🚀 Inicio Rápido (Desarrollo Local)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-organizacion/clinica-odontologica-py.git
cd clinica-odontologica-py

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación se ejecutará en `http://localhost:3000`.
