-- Phase 5 — Standby + Exclusiones (ciclo-dashboard parity)
-- Aplicar manualmente en Supabase SQL editor.
-- Idempotente: usa IF NOT EXISTS donde es posible.

-- 1) standby flag — pausa temporal de un cliente sin perder data
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS standby BOOLEAN DEFAULT FALSE;

-- 2) secciones excluidas — array con áreas que no aplican al cliente
--    valores válidos: 'copys' | 'grab' | 'edit' | 'diseno' | 'subida'
--    Ejemplo: ROMAX no hace diseño → ['diseno']
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS secciones_excluidas TEXT[] DEFAULT '{}';

-- 3) ciclo_mes — mes de producción (Phase 4)
--    Convención: 'mayo-2026' = lo que se sube en mayo 2026
--    NULL = usa el mes calendario por defecto
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS ciclo_mes TEXT;

-- 4) índice para filtros frecuentes
CREATE INDEX IF NOT EXISTS clientes_standby_idx ON public.clientes (agencia_id, standby);
CREATE INDEX IF NOT EXISTS clientes_ciclo_mes_idx ON public.clientes (agencia_id, ciclo_mes);

-- 5) backfill: marcar como NOT standby los existentes (default ya cubre)
UPDATE public.clientes SET standby = FALSE WHERE standby IS NULL;
UPDATE public.clientes SET secciones_excluidas = '{}' WHERE secciones_excluidas IS NULL;

-- Verificación
SELECT
  COUNT(*) AS total_clientes,
  COUNT(*) FILTER (WHERE standby = TRUE) AS en_standby,
  COUNT(*) FILTER (WHERE array_length(secciones_excluidas, 1) > 0) AS con_exclusiones
FROM public.clientes;
