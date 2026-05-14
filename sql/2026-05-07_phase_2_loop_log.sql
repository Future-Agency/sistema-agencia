-- Phase 2 — Loop Log (correcciones / quilombo histórico)
-- Aplicar manualmente en Supabase SQL editor.
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.loop_log (
  id BIGSERIAL PRIMARY KEY,

  -- Multi-tenancy
  agencia_id TEXT NOT NULL,
  cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,

  -- Contexto de la corrección
  seccion TEXT NOT NULL CHECK (seccion IN ('copys','grab','edit','diseno','subida')),
  from_state TEXT,
  to_state TEXT,
  stages_back INT NOT NULL DEFAULT 1,

  -- Ciclo de producción (puede diferir del mes calendario)
  ciclo_mes TEXT,

  -- Costo y responsabilidad
  cost_usd NUMERIC(10,2) DEFAULT 0,
  hourly_rate NUMERIC(8,2),
  stage_hours NUMERIC(5,2),
  responsable TEXT,                  -- nombre (e.g. 'Cesar')
  responsable_id TEXT,               -- futuro: equipo.id

  -- Razón / contexto
  reason TEXT,
  reason_category TEXT,              -- 'cliente_cambio_idea' | 'error_interno' | 'aprobacion_owner' | 'otro'

  -- Audit
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logged_by TEXT,                     -- nombre del user que registró
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loop_log_agencia_ciclo_idx
  ON public.loop_log (agencia_id, ciclo_mes);

CREATE INDEX IF NOT EXISTS loop_log_cliente_idx
  ON public.loop_log (cliente_id);

CREATE INDEX IF NOT EXISTS loop_log_responsable_idx
  ON public.loop_log (agencia_id, responsable);

CREATE INDEX IF NOT EXISTS loop_log_date_idx
  ON public.loop_log (date DESC);

CREATE INDEX IF NOT EXISTS loop_log_seccion_idx
  ON public.loop_log (agencia_id, seccion);

-- Verificación
SELECT
  COUNT(*) AS total_loops,
  COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
  COUNT(DISTINCT cliente_id) AS clientes_con_loops,
  COUNT(DISTINCT responsable) AS responsables_distintos
FROM public.loop_log;
