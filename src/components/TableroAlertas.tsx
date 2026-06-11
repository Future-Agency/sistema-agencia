'use client'
import { useMemo } from 'react'
import type { Cliente, ClienteCicloRecursos, DeudaContenido, FechaEspecial, Pieza } from '@/lib/supabase'
import { computarAlertas, severidadColor, type Alerta, type SeveridadAlerta } from '@/lib/alertas'

type Props = {
  clientes: Cliente[]
  piezas: Pieza[]
  deudas: DeudaContenido[]
  recursos: ClienteCicloRecursos[]
  fechas: FechaEspecial[]
  fechasContenidoHasta: Map<number, { fecha: Date; confirmada: boolean }>
  cicloActivo: string
  onSelectCliente?: (c: Cliente) => void
  onNavigate?: (view: string) => void
}

const ACCION_VIEW: Record<string, string> = {
  'Ir a Copys': 'copys',
  'Ir a Grab': 'grab',
  'Ir a Edición': 'edicion',
  'Ir a Diseño': 'diseno',
  'Ir a Subida': 'subida',
  'Ir a Anuncios': 'anuncios',
  'Ir a Deudas': 'deudas',
  'Ir a Fechas Especiales': 'fechas',
}

export default function TableroAlertas({ clientes, piezas, deudas, recursos, fechas, fechasContenidoHasta, cicloActivo, onSelectCliente, onNavigate }: Props) {
  const alertas = useMemo<Alerta[]>(
    () => computarAlertas({ clientes, piezas, deudas, recursos, fechas, fechasContenidoHasta, cicloActivo }),
    [clientes, piezas, deudas, recursos, fechas, fechasContenidoHasta, cicloActivo]
  )

  const clienteById = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes])

  const grupos = useMemo(() => {
    const g: Record<SeveridadAlerta, Alerta[]> = { critica: [], urgente: [], aviso: [] }
    for (const a of alertas) g[a.severidad].push(a)
    return g
  }, [alertas])

  const handleClick = (a: Alerta) => {
    if (a.clienteId && onSelectCliente) {
      const c = clienteById.get(a.clienteId)
      if (c) { onSelectCliente(c); return }
    }
    const view = ACCION_VIEW[a.accion]
    if (view && onNavigate) onNavigate(view)
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🚨 Alertas urgentes</h2>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0, marginTop: 2 }}>
            Lo que hay que arreglar HOY antes que nada más. Ordenado por gravedad.
            <strong style={{ color: '#f5365c', marginLeft: 6 }}>{grupos.critica.length} críticas</strong> ·
            <strong style={{ color: '#f5a623', marginLeft: 6 }}>{grupos.urgente.length} urgentes</strong> ·
            <strong style={{ color: '#5e72e4', marginLeft: 6 }}>{grupos.aviso.length} avisos</strong>
          </p>
        </div>
      </div>

      {alertas.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center' as const, color: '#00d97e' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✨</div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Todo en orden.</p>
          <p style={{ fontSize: 12, color: '#6a6a80' }}>No hay urgencias activas en el ciclo {cicloActivo}.</p>
        </div>
      ) : (
        <>
          {grupos.critica.length > 0 && (
            <Seccion titulo="🚨 CRÍTICAS" subtitulo="Acción inmediata necesaria" alertas={grupos.critica} onClick={handleClick} />
          )}
          {grupos.urgente.length > 0 && (
            <Seccion titulo="⚠ URGENTES" subtitulo="Atender esta semana" alertas={grupos.urgente} onClick={handleClick} />
          )}
          {grupos.aviso.length > 0 && (
            <Seccion titulo="ℹ AVISOS" subtitulo="Revisar pronto" alertas={grupos.aviso} onClick={handleClick} />
          )}
        </>
      )}
    </div>
  )
}

function Seccion({ titulo, subtitulo, alertas, onClick }: { titulo: string; subtitulo: string; alertas: Alerta[]; onClick: (a: Alerta) => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: severidadColor(alertas[0].severidad).color, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
          {titulo} ({alertas.length})
        </div>
        <div style={{ fontSize: 11, color: '#6a6a80' }}>{subtitulo}</div>
      </div>
      <div style={{ background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 8, overflow: 'hidden' as const }}>
        {alertas.map((a, i) => {
          const col = severidadColor(a.severidad)
          return (
            <div key={a.id}
              onClick={() => onClick(a)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                borderTop: i > 0 ? '1px solid #2a2a40' : 'none',
                borderLeft: `3px solid ${col.bgSolid}`,
                cursor: 'pointer',
                transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#22223a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{a.icono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{a.titulo}</div>
                <div style={{ fontSize: 11, color: '#a0a0b8', lineHeight: 1.4 }}>{a.descripcion}</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 4,
                background: col.bg, border: `1px solid ${col.border}`, color: col.color,
                flexShrink: 0, whiteSpace: 'nowrap' as const,
              }}>{a.accion} →</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
