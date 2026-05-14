-- Phase A — Piezas (modelo de producción a nivel deliverable)
-- Cada cliente x ciclo_mes genera N piezas. Cada pieza recorre su propio pipeline
-- según su tipo (video/portada/carrousel/historia).

-- 1) Plan de producción por cliente (cantidades por mes)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS plan_videos      INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS plan_portadas    INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS plan_carrouseles INT DEFAULT 4,
  ADD COLUMN IF NOT EXISTS plan_historias   INT DEFAULT 4;

-- Backfill: existentes sin plan → defaults
UPDATE public.clientes SET plan_videos      = 15 WHERE plan_videos      IS NULL;
UPDATE public.clientes SET plan_portadas    = 15 WHERE plan_portadas    IS NULL;
UPDATE public.clientes SET plan_carrouseles = 4  WHERE plan_carrouseles IS NULL;
UPDATE public.clientes SET plan_historias   = 4  WHERE plan_historias   IS NULL;

-- 2) Tabla piezas
CREATE TABLE IF NOT EXISTS public.piezas (
  id BIGSERIAL PRIMARY KEY,
  agencia_id TEXT NOT NULL,
  cliente_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,

  -- Identidad
  tipo TEXT NOT NULL CHECK (tipo IN ('video','portada','carrousel','historia')),
  ciclo_mes TEXT NOT NULL,         -- 'mayo-2026'
  numero INT NOT NULL,             -- 1..N dentro del tipo
  titulo TEXT,                     -- "Video 5: Tutorial CRM" (opcional)

  -- Pipeline state — cada pieza atraviesa el suyo (vacío = pendiente o no aplica)
  estado_copys TEXT DEFAULT '',
  estado_grab TEXT DEFAULT '',
  estado_edicion TEXT DEFAULT '',
  estado_diseno TEXT DEFAULT '',
  estado_subida TEXT DEFAULT '',
  estado_anuncios TEXT DEFAULT '',
  estado_changed_at TIMESTAMPTZ,

  -- Asignaciones (TEXT porque equipo.id es text)
  copywriter_id TEXT,
  editor_id TEXT,
  disenador_id TEXT,
  cm_id TEXT,

  -- Links externos — la pieza no avanza sin estos cuando aplica
  drive_url TEXT,                  -- material crudo Y editado (Google Drive)
  guion_url TEXT,                  -- doc del guión (Drive/Docs)
  preview_url TEXT,                -- preview del video editado para review
  metricool_url TEXT,              -- link a la programación
  publicacion_url TEXT,            -- post live (instagram/tiktok/etc)

  -- Metadata
  fecha_grabacion DATE,
  fecha_publicacion DATE,          -- cuándo se programó publicar
  califica_ads BOOLEAN DEFAULT FALSE,
  ad_account_id BIGINT REFERENCES public.ad_accounts(id) ON DELETE SET NULL,

  -- Padre — para portadas vinculadas a un video
  pieza_padre_id BIGINT REFERENCES public.piezas(id) ON DELETE SET NULL,

  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- No duplicar el mismo número en el mismo ciclo+tipo del mismo cliente
  UNIQUE (cliente_id, ciclo_mes, tipo, numero)
);

-- Índices
CREATE INDEX IF NOT EXISTS piezas_cliente_ciclo_idx ON public.piezas (agencia_id, cliente_id, ciclo_mes);
CREATE INDEX IF NOT EXISTS piezas_pipeline_idx     ON public.piezas (agencia_id, ciclo_mes, tipo);
CREATE INDEX IF NOT EXISTS piezas_copywriter_idx   ON public.piezas (copywriter_id) WHERE copywriter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS piezas_editor_idx       ON public.piezas (editor_id)     WHERE editor_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS piezas_disenador_idx    ON public.piezas (disenador_id)  WHERE disenador_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS piezas_publicacion_idx  ON public.piezas (agencia_id, fecha_publicacion) WHERE fecha_publicacion IS NOT NULL;
