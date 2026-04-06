-- Migración 001: Sistema de disponibilidad recurrente
-- Ejecutar en Supabase o Railway SQL Editor

-- 1. Tabla de reglas de disponibilidad semanal recurrente
CREATE TABLE IF NOT EXISTS disponibilidad (
  id                SERIAL PRIMARY KEY,
  dia_semana        INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio       TIME NOT NULL,
  hora_fin          TIME NOT NULL,
  duracion_minutos  INT NOT NULL DEFAULT 60,
  activa            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_hora_orden CHECK (hora_fin > hora_inicio)
);

-- dia_semana usa la convención de JS getDay(): 0=Domingo, 1=Lunes, ..., 6=Sábado

-- 2. Hacer horario_id nullable en turnos para soportar slots virtuales
--    (los turnos viejos mantienen su horario_id intacto)
ALTER TABLE turnos ALTER COLUMN horario_id DROP NOT NULL;

-- 3. Índice único parcial para evitar double-booking a nivel de base de datos
--    (solo aplica a turnos confirmados; los cancelados no bloquean el slot)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_turno_confirmado
  ON turnos (fecha, hora)
  WHERE estado = 'confirmado';
