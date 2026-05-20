-- Rename CORRECCIÓN FRAN/CLIENTE → REVISIÓN FRAN/CLIENTE en piezas y clientes
-- + nueva columna estado "CORRECCIÓN" (id 5 en COPYS_REGULAR)
-- + columnas para links requeridos: correcciones_link, pendiente_info_link
-- Fecha: 2026-05-20

UPDATE piezas SET estado_copys = 'REVISIÓN FRAN' WHERE estado_copys = 'CORRECCIÓN FRAN';
UPDATE piezas SET estado_copys = 'REVISIÓN CLIENTE' WHERE estado_copys = 'CORRECCIÓN CLIENTE';
UPDATE clientes SET estado_copys = 'REVISIÓN FRAN' WHERE estado_copys = 'CORRECCIÓN FRAN';
UPDATE clientes SET estado_copys = 'REVISIÓN CLIENTE' WHERE estado_copys = 'CORRECCIÓN CLIENTE';

ALTER TABLE cliente_ciclo_recursos
  ADD COLUMN IF NOT EXISTS correcciones_link text,
  ADD COLUMN IF NOT EXISTS pendiente_info_link text;

COMMENT ON COLUMN cliente_ciclo_recursos.correcciones_link IS
  'Link al documento con las correcciones (requerido para mandar el batch al estado CORRECCIÓN en Copys).';
COMMENT ON COLUMN cliente_ciclo_recursos.pendiente_info_link IS
  'Link al documento de info que estabamos esperando (requerido para salir de PENDIENTE DE INFORMACIÓN salvo que se marque NO APLICA).';
