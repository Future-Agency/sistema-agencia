-- Phase 9 — Fechas Especiales + Pedidos Clientes
-- Eventos con anticipación (Día del Padre, Black Friday, etc.) + pedidos one-off por cliente.

CREATE TABLE IF NOT EXISTS public.fechas_especiales (
  id BIGSERIAL PRIMARY KEY,
  agencia_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  fecha_evento DATE NOT NULL,
  dias_anticipacion INT NOT NULL DEFAULT 15 CHECK (dias_anticipacion >= 0),
  client_states JSONB DEFAULT '{}'::jsonb,
  creado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fechas_especiales_agencia_idx ON public.fechas_especiales (agencia_id, fecha_evento);

CREATE TABLE IF NOT EXISTS public.pedidos_clientes (
  id BIGSERIAL PRIMARY KEY,
  agencia_id TEXT NOT NULL,
  cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  areas TEXT[] DEFAULT '{}',
  stage_states JSONB DEFAULT '{}'::jsonb,
  deadline DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_curso','completado','cancelado')),
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','urgente')),
  responsable TEXT,
  notas TEXT,
  creado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pedidos_clientes_agencia_estado_idx ON public.pedidos_clientes (agencia_id, estado);
CREATE INDEX IF NOT EXISTS pedidos_clientes_cliente_idx ON public.pedidos_clientes (cliente_id);
CREATE INDEX IF NOT EXISTS pedidos_clientes_deadline_idx ON public.pedidos_clientes (agencia_id, deadline);
