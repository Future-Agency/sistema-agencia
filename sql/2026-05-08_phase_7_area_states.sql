-- Phase 7 — Per-area state columns (ciclo-dashboard parity)
-- estado_edicion y estado_diseno ya existen. Agregamos los faltantes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS estado_copys TEXT DEFAULT '';

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS estado_grab TEXT DEFAULT '';

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS estado_subida TEXT DEFAULT '';

-- Backfill: si están NULL → vacío
UPDATE public.clientes SET estado_copys = '' WHERE estado_copys IS NULL;
UPDATE public.clientes SET estado_grab = '' WHERE estado_grab IS NULL;
UPDATE public.clientes SET estado_subida = '' WHERE estado_subida IS NULL;

-- Index para queries
CREATE INDEX IF NOT EXISTS clientes_estado_copys_idx ON public.clientes (agencia_id, estado_copys);
CREATE INDEX IF NOT EXISTS clientes_estado_grab_idx ON public.clientes (agencia_id, estado_grab);
CREATE INDEX IF NOT EXISTS clientes_estado_subida_idx ON public.clientes (agencia_id, estado_subida);
