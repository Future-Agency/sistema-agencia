-- B8: Notas / fallas / correcciones / mejoras por pipeline (alimentan el reporte de cierre)
-- Fecha: 2026-05-18

CREATE TABLE IF NOT EXISTS pipeline_notas (
  id bigserial PRIMARY KEY,
  agencia_id text NOT NULL DEFAULT 'future',
  area text NOT NULL CHECK (area IN ('copys','grab','edit','diseno','subida','anuncios','general')),
  cliente_id bigint REFERENCES clientes(id) ON DELETE CASCADE,
  ciclo_mes text NOT NULL,
  tipo text NOT NULL DEFAULT 'nota' CHECK (tipo IN ('nota','falla','correccion','mejora')),
  texto text NOT NULL,
  autor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notas_agencia_ciclo ON pipeline_notas(agencia_id, ciclo_mes);
CREATE INDEX IF NOT EXISTS idx_notas_area_ciclo ON pipeline_notas(area, ciclo_mes);

COMMENT ON TABLE pipeline_notas IS 'Notas / fallas / correcciones / mejoras registradas durante el ciclo por área. Alimentan el reporte de cierre de ciclo generado con Claude.';
COMMENT ON COLUMN pipeline_notas.area IS 'Área de la pipeline. general = no asociada a un área específica.';
COMMENT ON COLUMN pipeline_notas.cliente_id IS 'NULL = nota global del ciclo (no atada a un cliente).';
