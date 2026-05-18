-- B5: Fechas Especiales — clientes participantes + areas aplica/no aplica + info gate
-- Fecha: 2026-05-18

ALTER TABLE fechas_especiales
  ADD COLUMN IF NOT EXISTS clientes_participantes bigint[],
  ADD COLUMN IF NOT EXISTS areas text[],
  ADD COLUMN IF NOT EXISTS areas_no_aplica text[],
  ADD COLUMN IF NOT EXISTS info_requerida text,
  ADD COLUMN IF NOT EXISTS info_lista boolean DEFAULT false;

COMMENT ON COLUMN fechas_especiales.clientes_participantes IS
  'Array de cliente_id que participan en esta fecha especial.';
COMMENT ON COLUMN fechas_especiales.info_requerida IS
  'Descripción de la info que se precisa para arrancar (brief, oferta, productos, etc.). Sin info_lista=true, el gate bloquea avanzar.';
COMMENT ON COLUMN fechas_especiales.info_lista IS
  'Si true, la info requerida ya está cargada y se puede avanzar con la producción.';
