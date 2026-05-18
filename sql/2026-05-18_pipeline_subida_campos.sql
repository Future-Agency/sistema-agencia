-- Phase: Campos del cierre de pipeline Subida (B2)
-- Fecha: 2026-05-18
--
-- Agrega 2 columnas a cliente_ciclo_recursos para que el encargado de subida
-- valide en el cierre: cuántos contenidos efectivamente se subieron + cuál es
-- la última fecha de contenido programado del ciclo.
--
-- No destructivo: solo ADD COLUMN.

ALTER TABLE cliente_ciclo_recursos
  ADD COLUMN IF NOT EXISTS cantidad_contenidos_subidos integer,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_contenido_subido date;

COMMENT ON COLUMN cliente_ciclo_recursos.cantidad_contenidos_subidos IS
  'Cantidad de contenidos efectivamente subidos en el ciclo (validable contra lo pactado: plan_videos+plan_portadas+plan_carrouseles+plan_historias)';
COMMENT ON COLUMN cliente_ciclo_recursos.fecha_ultimo_contenido_subido IS
  'Fecha del último contenido programado/publicado del ciclo — para saber hasta cuándo hay contenido planificado.';
