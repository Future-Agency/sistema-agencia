-- B4: Pedidos Especiales — areas explícitamente "NO APLICA"
-- Fecha: 2026-05-18
--
-- Antes había solo `areas text[]` (las que aplican). Ahora 3 estados:
--   - en areas: APLICA
--   - en areas_no_aplica: NO APLICA (explícito)
--   - en ninguna: sin marcar

ALTER TABLE pedidos_clientes
  ADD COLUMN IF NOT EXISTS areas_no_aplica text[];

COMMENT ON COLUMN pedidos_clientes.areas_no_aplica IS
  'Áreas explícitamente marcadas como NO APLICA para este pedido. Junto con la columna areas (que aplican), permite 3 estados: aplica / no_aplica / sin_marcar.';
