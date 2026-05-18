-- B3: Sistema de deudas de contenido
-- Fecha: 2026-05-18
--
-- Tabla nueva para trackear deudas por cliente.
-- Auto-generadas al cerrar pipeline Subida si subidos < pactado.
-- También permite creación/edición manual.

CREATE TABLE IF NOT EXISTS deudas_contenido (
  id bigserial PRIMARY KEY,
  agencia_id text NOT NULL DEFAULT 'future',
  cliente_id bigint NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  ciclo_origen text NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad != 0),
  motivo text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'saldada', 'cancelada')),
  origen text NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'auto_subida')),
  creado_por text,
  resolved_at timestamptz,
  resolved_by text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deudas_cliente_estado ON deudas_contenido(cliente_id, estado);
CREATE INDEX IF NOT EXISTS idx_deudas_agencia ON deudas_contenido(agencia_id);

COMMENT ON TABLE deudas_contenido IS
  'Deudas de contenido por cliente. cantidad positiva = debemos contenido al cliente; cantidad negativa = saldo a favor.';
COMMENT ON COLUMN deudas_contenido.cantidad IS
  'Cantidad de contenidos. Positivo = debemos; negativo = saldo a favor. No puede ser cero.';
COMMENT ON COLUMN deudas_contenido.origen IS
  'manual = creada por un user. auto_subida = generada automáticamente al cerrar pipeline Subida cuando cantidad_contenidos_subidos < lo pactado.';
