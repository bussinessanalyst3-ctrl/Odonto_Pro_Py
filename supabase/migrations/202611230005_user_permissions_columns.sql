-- ============================================================================
-- MIGRACIÓN SQL ADITIVA E IDEMPOTENTE — ODONTOPRO
-- Versión: 202611230005_user_permissions_columns.sql
-- Descripción:
--   Garantiza la existencia de columnas de permisos por rol y overrides
--   individuales por usuario/sesión (solo ADD COLUMN IF NOT EXISTS).
--   Compatibilidad total hacia atrás:
--   - allowed_nav_tabs = '[]'::jsonb significa "heredar los módulos del rol".
--   - Ningún usuario existente pierde ni altera accesos al aplicar esta migración.
-- ============================================================================

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_nav_tabs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revoked_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allowed_nav_tabs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 1;
