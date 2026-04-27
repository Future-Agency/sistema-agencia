'use client'
import { useState } from 'react'
import { supabase, type ClienteAprobacion, type FunnelStage } from '@/lib/supabase'
import { FUNNEL_INFO, FunnelPill, TipoBadge } from './ui'

type Props = {
  aprobaciones: ClienteAprobacion[]
  clienteId: number
  onUpdate: () => void
}

const FILTROS: { id: 'todos' | 'pendiente' | 'aprobado' | 'cambios_solicitados'; label: string }[] = [
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'cambios_solicitados', label: 'Cambios pedidos' },
  { id: 'aprobado', label: 'Aprobados' },
  { id: 'todos', label: 'Todos' },
]

export default function PortalSeccionAprobaciones({ aprobaciones, onUpdate }: Props) {
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'cambios_solicitados'>('pendiente')
  const [funnelFiltro, setFunnelFiltro] = useState<'todos' | FunnelStage>('todos')
  const [comentando, setComentando] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')

  const filtradas = aprobaciones.filter(a => {
    if (filtro !== 'todos' && a.estado !== filtro) return false
    if (funnelFiltro !== 'todos' && a.funnel !== funnelFiltro) return false
    return true
  })

  async function aprobar(id: number) {
    await supabase.from('cliente_aprobaciones').update({
      estado: 'aprobado',
      fecha_aprobacion: new Date().toISOString(),
      visto_por_agencia: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    onUpdate()
  }

  async function pedirCambios(id: number) {
    if (!comentario.trim()) return
    await supabase.from('cliente_aprobaciones').update({
      estado: 'cambios_solicitados',
      comentario_cliente: comentario,
      visto_por_agencia: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setComentando(null)
    setComentario('')
    onUpdate()
  }

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 className="fa-section-h1">Aprobaciones</h1>
        <p className="fa-section-sub">Revisá y aprobá el contenido. Cada pieza muestra a qué etapa del embudo apunta.</p>
      </div>

      {/* Funnel legend bar */}
      <div className="fa-card fa-card-tight" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, padding: '12px 16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Embudo:</span>
        {Object.entries(FUNNEL_INFO).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 50, background: v.color }} />
            <span style={{ fontSize: 11, color: 'var(--text)' }}><strong>{v.short}</strong> <span style={{ color: 'var(--text-muted)' }}>{v.desc}</span></span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {FILTROS.map(f => {
          const c = f.id === 'todos' ? aprobaciones.length : aprobaciones.filter(a => a.estado === f.id).length
          const a = filtro === f.id
          return (
            <button key={f.id} onClick={() => setFiltro(f.id)} style={{
              padding: '7px 14px',
              background: a ? 'rgba(36,56,255,0.13)' : 'var(--card)',
              border: `1px solid ${a ? 'rgba(36,56,255,0.4)' : 'var(--border)'}`,
              color: a ? 'var(--brand-blue-soft)' : 'var(--text-muted)',
              borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{f.label} ({c})</button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {(['todos', 'tofu', 'mofu', 'bofu'] as const).map(f => {
          const a = funnelFiltro === f
          const info = f === 'todos' ? null : FUNNEL_INFO[f]
          return (
            <button key={f} onClick={() => setFunnelFiltro(f)} style={{
              padding: '5px 12px',
              background: a ? 'var(--bg-1)' : 'transparent',
              border: '1px solid var(--border-2)',
              color: a ? 'var(--text)' : 'var(--text-muted)',
              borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>{info && <span style={{ width: 8, height: 8, borderRadius: 50, background: info.color }} />}{f}</button>
          )
        })}
      </div>

      {filtradas.length === 0 ? (
        <div className="fa-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          <i className="fas fa-inbox" style={{ fontSize: 36, marginBottom: 12, color: 'var(--text-dim)' }} />
          <div>Sin aprobaciones para mostrar</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filtradas.map(a => {
            const isPend = a.estado === 'pendiente'
            const isApr = a.estado === 'aprobado'
            const isCam = a.estado === 'cambios_solicitados'
            const estadoColor = isApr ? 'var(--ok)' : isCam ? 'var(--warn)' : 'var(--brand-blue)'
            const f = a.funnel ? FUNNEL_INFO[a.funnel] : null

            return (
              <div key={a.id} className="fa-card" style={{ padding: 0, border: `1px solid ${isPend ? 'rgba(36,56,255,0.3)' : 'var(--border)'}`, overflow: 'hidden' }}>
                {f && <div style={{ height: 4, background: f.color, opacity: 0.7 }} />}
                <div style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <TipoBadge tipo={a.tipo} />
                        <FunnelPill stage={a.funnel} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {new Date(a.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                        {a.dur && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {a.dur}</span>}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{a.titulo}</div>
                      {a.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.descripcion}</div>}
                      {f && (
                        <div style={{ fontSize: 11, color: f.color, marginTop: 6, fontWeight: 500 }}>
                          <i className={`fas ${f.icon}`} style={{ marginRight: 5 }} />Apunta a: {f.desc.toLowerCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{ padding: '4px 10px', background: `color-mix(in srgb, ${estadoColor} 18%, transparent)`, color: estadoColor, borderRadius: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                        {a.estado.replace('_', ' ')}
                      </span>
                      <div className="fa-stripes" style={{ width: 110, height: 70, borderRadius: 8 }}>
                        <div style={{ textAlign: 'center', padding: 4 }}>
                          <i className="fas fa-play" style={{ fontSize: 14, color: 'var(--text)' }} />
                          <div style={{ fontSize: 8, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>preview</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {a.url_preview && (
                    <a href={a.url_preview} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, textDecoration: 'none', marginBottom: 10 }}>
                      <i className="fas fa-external-link-alt" /> Ver material en Drive
                    </a>
                  )}

                  {a.comentario_cliente && (
                    <div style={{ marginTop: 6, marginBottom: 10, padding: 10, background: 'rgba(245,166,35,0.08)', borderLeft: '3px solid var(--warn)', borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Tu comentario</div>
                      <div style={{ fontSize: 13 }}>{a.comentario_cliente}</div>
                    </div>
                  )}

                  {isPend && comentando !== a.id && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="fa-btn fa-btn-ok" onClick={() => aprobar(a.id)}><i className="fas fa-check" /> Aprobar</button>
                      <button className="fa-btn fa-btn-warn" onClick={() => { setComentando(a.id); setComentario('') }}><i className="fas fa-comment-dots" /> Pedir cambios</button>
                    </div>
                  )}

                  {comentando === a.id && (
                    <div>
                      <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="¿Qué cambios querés? (más detallado mejor)" autoFocus style={{
                        width: '100%', minHeight: 80, padding: 12, background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                      }} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="fa-btn fa-btn-warn" style={{ background: 'var(--warn)', color: '#0a0a0a', border: 'none' }} onClick={() => pedirCambios(a.id)} disabled={!comentario.trim()}>Enviar comentario</button>
                        <button className="fa-btn fa-btn-ghost" onClick={() => setComentando(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
