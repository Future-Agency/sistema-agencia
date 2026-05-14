-- Phase A.2 — Recursos consolidados por cliente x ciclo
-- 1 link por área del mes en vez de N links por pieza.

CREATE TABLE IF NOT EXISTS public.cliente_ciclo_recursos (
  id BIGSERIAL PRIMARY KEY,
  agencia_id TEXT NOT NULL,
  cliente_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ciclo_mes TEXT NOT NULL,

  -- Carpetas Drive consolidadas del ciclo
  drive_scripts_url TEXT,
  drive_videos_crudos_url TEXT,
  drive_videos_editados_url TEXT,
  drive_portadas_url TEXT,
  drive_carrouseles_url TEXT,
  drive_historias_url TEXT,

  -- Herramientas externas
  metricool_url TEXT,
  reporte_url TEXT,

  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (cliente_id, ciclo_mes)
);

CREATE INDEX IF NOT EXISTS cliente_ciclo_recursos_idx ON public.cliente_ciclo_recursos (agencia_id, cliente_id, ciclo_mes);
