-- Phase: PENDIENTE DE INFORMACIÓN en pipeline Copys
-- Fecha: 2026-05-17
--
-- Agrega 3 columnas a cliente_ciclo_recursos para capturar:
--   - motivos por los cuales el batch está pendiente de info (multi-select)
--   - texto libre para el motivo "OTRO"
--   - flag para marcar el batch como "NO APLICA" en este ciclo (saltea el estado)
--
-- No destructivo: solo ADD COLUMN, no afecta data existente.
-- Defaults: motivos NULL, otro NULL, no_aplica false.

ALTER TABLE cliente_ciclo_recursos
  ADD COLUMN IF NOT EXISTS pendiente_info_motivos text[],
  ADD COLUMN IF NOT EXISTS pendiente_info_otro text,
  ADD COLUMN IF NOT EXISTS pendiente_info_no_aplica boolean DEFAULT false;

-- Comentarios para la docs
COMMENT ON COLUMN cliente_ciclo_recursos.pendiente_info_motivos IS
  'Lista de motivos por los cuales el batch está pendiente de info en copys. Valores canónicos: ESPERANDO_OFERTA, EXCEL_PRODUCTOS, PRECIOS, STOCK, LLAMADA, INFORMACION_EVENTO, OTRO';
COMMENT ON COLUMN cliente_ciclo_recursos.pendiente_info_otro IS
  'Texto libre cuando pendiente_info_motivos contiene OTRO';
COMMENT ON COLUMN cliente_ciclo_recursos.pendiente_info_no_aplica IS
  'Si true, el batch saltea PENDIENTE DE INFORMACIÓN en este ciclo (no aplica). Bloqueable más adelante para pedidos/fechas especiales (B4/B5).';
