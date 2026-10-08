-- ==============================================================================
-- TABLERO DE CONSULTAS SQL PARA AUDITORÍA Y MONITOREO (ODONTOPRO - SUPABASE)
-- Copia y pega cualquiera de estas consultas en el SQL Editor de Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLERO DE CONTROL GLOBAL (Métricas clave del sistema en una sola vista)
-- ------------------------------------------------------------------------------
SELECT 
  data->'data'->'organization'->>'name' AS clinica,
  data->'data'->'organization'->>'taxId' AS ruc,
  jsonb_array_length(COALESCE(data->'data'->'users', '[]'::jsonb)) AS total_usuarios,
  jsonb_array_length(COALESCE(data->'data'->'patients', '[]'::jsonb)) AS total_pacientes,
  jsonb_array_length(COALESCE(data->'data'->'branches', '[]'::jsonb)) AS total_sucursales,
  jsonb_array_length(COALESCE(data->'data'->'dentalChairs', '[]'::jsonb)) AS sillones_dentales,
  jsonb_array_length(COALESCE(data->'data'->'appointments', '[]'::jsonb)) AS total_citas,
  jsonb_array_length(COALESCE(data->'data'->'payments', '[]'::jsonb)) AS total_pagos_registrados,
  jsonb_array_length(COALESCE(data->'data'->'auditLogs', '[]'::jsonb)) AS eventos_auditoria,
  updated_at AS ultima_sincronizacion
FROM system_state
WHERE key = 'app_state';


-- ------------------------------------------------------------------------------
-- 2. PISTA DE AUDITORÍA Y SEGURIDAD (Quién hizo qué, cuándo y desde qué IP)
-- Conforme a la Ley N° 1682/01 de Protección de Datos Médicos
-- ------------------------------------------------------------------------------
SELECT 
  log->>'createdAt' AS fecha_hora,
  log->>'action' AS accion,
  log->>'entity' AS entidad_afectada,
  log->>'description' AS detalle_operacion,
  log->>'ipAddress' AS ip_origen,
  log->>'userId' AS id_usuario_responsable
FROM system_state,
LATERAL jsonb_array_elements(COALESCE(data->'data'->'auditLogs', '[]'::jsonb)) AS log
ORDER BY (log->>'createdAt') DESC
LIMIT 50;


-- ------------------------------------------------------------------------------
-- 3. PERSONAL Y FUNCIONARIOS (Usuarios, Roles RBAC, Licencias y Estado)
-- ------------------------------------------------------------------------------
SELECT 
  u->>'firstName' || ' ' || (u->>'lastName') AS nombre_completo,
  u->>'email' AS correo,
  u->>'username' AS usuario,
  u->>'roleId' AS rol_institucional,
  COALESCE(u->>'specialty', 'General') AS especialidad,
  COALESCE(u->>'professionalLicense', 'N/A') AS registro_profesional,
  u->>'status' AS estado,
  u->>'lastLoginAt' AS ultimo_acceso
FROM system_state,
LATERAL jsonb_array_elements(COALESCE(data->'data'->'users', '[]'::jsonb)) AS u
ORDER BY u->>'roleId' ASC, nombre_completo ASC;


-- ------------------------------------------------------------------------------
-- 4. PACIENTES REGISTRADOS (Cédula paraguaya, WhatsApp, Seguro Médico)
-- ------------------------------------------------------------------------------
SELECT 
  p->>'firstName' || ' ' || (p->>'lastName') AS paciente,
  p->>'documentNumber' AS cedula_identidad,
  COALESCE(p->>'whatsapp', p->>'phone', 'Sin teléfono') AS whatsapp_contacto,
  COALESCE(p->>'medicalInsurance', 'Particular') AS seguro_medico,
  p->>'status' AS estado,
  p->>'createdAt' AS fecha_registro
FROM system_state,
LATERAL jsonb_array_elements(COALESCE(data->'data'->'patients', '[]'::jsonb)) AS p
ORDER BY p->>'createdAt' DESC;


-- ------------------------------------------------------------------------------
-- 5. AGENDA DE TURNOS Y CITAS ODONTOLÓGICAS
-- ------------------------------------------------------------------------------
SELECT 
  a->>'scheduledDate' AS fecha_turno,
  a->>'startTime' || ' - ' || (a->>'endTime') AS horario,
  a->>'patientName' AS paciente,
  a->>'dentistName' AS odontologo,
  a->>'branchName' AS sucursal,
  COALESCE(a->>'chairName', 'Box General') AS sillon,
  a->>'status' AS estado_turno,
  a->>'notes' AS observaciones
FROM system_state,
LATERAL jsonb_array_elements(COALESCE(data->'data'->'appointments', '[]'::jsonb)) AS a
ORDER BY a->>'scheduledDate' DESC, a->>'startTime' ASC;


-- ------------------------------------------------------------------------------
-- 6. CAJA, FACTURACIÓN Y PAGOS (Monto en Guaraníes PYG, Método de Cobro)
-- ------------------------------------------------------------------------------
SELECT 
  pay->>'createdAt' AS fecha_pago,
  pay->>'patientName' AS paciente,
  TO_CHAR((pay->>'amount')::NUMERIC, 'FM999G999G999') || ' PYG' AS monto_guaranies,
  pay->>'paymentMethod' AS metodo_pago, -- EFECTIVO, TARJETA, TRANSFERENCIA_SIPAP, POS
  COALESCE(pay->>'invoiceNumber', 'Comprobante interno') AS factura_timbrado,
  pay->>'status' AS estado_pago
FROM system_state,
LATERAL jsonb_array_elements(COALESCE(data->'data'->'payments', '[]'::jsonb)) AS pay
ORDER BY pay->>'createdAt' DESC;


-- ------------------------------------------------------------------------------
-- 7. SUCURSALES, HORARIOS DE ATENCIÓN Y SILLONES DENTALES
-- ------------------------------------------------------------------------------
SELECT 
  b->>'name' AS sucursal,
  b->>'city' AS ciudad,
  b->>'address' AS direccion,
  b->>'phone' AS telefono,
  b->>'openingTime' || ' a ' || (b->>'closingTime') AS horario_atencion,
  b->>'status' AS estado
FROM system_state,
LATERAL jsonb_array_elements(COALESCE(data->'data'->'branches', '[]'::jsonb)) AS b;


-- ------------------------------------------------------------------------------
-- 8. CATÁLOGO DE ARANCELES Y TRATAMIENTOS ODONTOLÓGICOS HABILITADOS
-- ------------------------------------------------------------------------------
SELECT 
  s->>'category' AS categoria,
  s->>'name' AS procedimiento,
  TO_CHAR((s->>'basePrice')::NUMERIC, 'FM999G999G999') || ' PYG' AS precio_arancel,
  s->>'defaultDurationMin' || ' min' AS duracion_estimada,
  s->>'status' AS estado
FROM system_state,
LATERAL jsonb_array_elements(COALESCE(data->'data'->'services', '[]'::jsonb)) AS s
ORDER BY s->>'category' ASC, s->>'name' ASC;
