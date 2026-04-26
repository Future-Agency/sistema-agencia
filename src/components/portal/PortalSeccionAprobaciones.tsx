'use client'
import { useState } from 'react'
import { supabase, type ClienteAprobacion } from '@/lib/supabase'

type Props = {
  aprobaciones: ClienteAprobacion[]
  clienteId: number
  onUpdate: () => void
  colorPrimario: string
}

const TIPO_INFO: Record<string, { label: string; icon: string; color: string }> = {
  reel: { label: 'Reel', icon: 'fa-film', color: '#5e72e4' },
  historia: { label: 'Historia', icon: 'fa-book-open', color: '#f5a623' },
  carrousel: { label: 'Carrousel', icon: 'fa-layer-group', color: '#8965e0' },
  anuncio: { label: 'Anuncio', icon: 'fa-bullhorn', color: '#f5365c' },
  guion: { label: 'Guion', icon: 'fa-scroll', color: '#11cdef' },
}

const FILTROS: { id: 'todos' | 'pendiente' | 'aprobado' | 'cambios_solicitados'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendiente', label: 'Pendientes' },
  { id: 'aprobado', label: 'Aprobados' },
  { id: 'cambios_solicitados', label: 'Cambios pedidos' },
]

export default function PortalSeccionAprobaciones({ aprobaciones, onUpdate, colorPrimario }: Props) {
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'cambios_solicitados'>('pendiente')
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [comentando, setComentando] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  const filtradas = aprobaciones.filter(a => {
    if (filtro !== 'todos' && a.estado !== filtro) return false
    if (tipoFiltro !== 'todos' && a.tipo !== tipoFiltro) return false
    return true
  })

  async function aprobar(id: number) {
    setBusy(id)
    await supabase.from('cliente_aprobaciones').update({
      estado: 'aprobado',
      fecha_aprobacion: new Date().toISOString(),
      visto_por_agencia: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setBusy(null)
    onUpdate()
  }

  async function pedirCambios(id: number) {
    if (!comentario.trim()) return
    setBusy(id)
    await supabase.from('cliente_aprobaciones').update({
      estado: 'cambios_solicitados',
      comentario_cliente: comentario,
      visto_por_agencia: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setComentando(null)
    setComentario('')
    setBusy(null)
    onUpdate()
  }

  const tipos = ['todos', 'reel', 'historia', 'carrousel', 'anuncio', 'guion']

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Aprobaciones</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 20 }}>Aproba el contenido o solicita cambios con tus comentarios</p>

      {/* Filtros estado */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTROS.map(f => {
          const count = f.id === 'todos' ? aprobaciones.length : aprobaciones.filter(a => a.estado === f.id).length
          const active = filtro === f.id
          return (
            <button key={f.id} onClick={() => setFiltro(f.id)} style={{
              padding: '7px 14px',
              background: active ? `${colorPrimario}22` : '#14142a',
              border: `1px solid ${active ? colorPrimario + '55' : '#1a1a2e'}`,
              color: active ? colorPrimario : '#a0a0b8',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              {f.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Filtros tipo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tipos.map(t => {
          const active = tipoFiltro === t
          const info = t === 'todos' ? null : TIPO_INFO[t]
          return (
            <button key={t} onClick={() => setTipoFiltro(t)} style={{
              padding: '5px 12px',
              background: active ? '#1a1a2e' : 'transparent',
              border: '1px solid #2a2a40',
              color: active ? '#e8e8f0' : '#6a6a80',
              borderRadius: 16,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}>
              {info && <i className={`fas ${info.icon}`} style={{ marginRight: 5, color: info.color }} />}
              {t}
            </button>
          )
        })}
      </div>

      {filtradas.length === 0 ? (
        <div style={{ padding: 40, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80' }}>
          <i className="fas fa-inbox" style={{ fontSize: 36, marginBottom: 12, color: '#3a3a55' }} />
          <div>Sin aprobaciones para mostrar</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtradas.map(a => {
            const info = TIPO_INFO[a.tipo] || { label: a.tipo, icon: 'fa-file', color: '#a0a0b8' }
            const isPendiente = a.estado === 'pendiente'
            const isAprobado = a.estado === 'aprobado'
            const isCambios = a.estado === 'cambios_solicitados'
            const estadoColor = isAprobado ? '#00d97e' : isCambios ? '#f5a623' : colorPrimario
            return (
              <div key={a.id} style={{
                padding: 18,
                background: '#14142a',
                border: `1px solid ${isPendiente ? colorPrimario + '40' : '#1a1a2e'}`,
                borderRadius: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 9px',
                        background: `${info.color}22`,
                        color: info.color,
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        <i className={`fas ${info.icon}`} style={{ marginRight: 5 }} />
                        {info.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#6a6a80' }}>
                        {new Date(a.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{a.titulo}</div>
                    {a.descripcion && <div style={{ fontSize: 12, color: '#a0a0b8' }}>{a.descripcion}</div>}
                  </div>
                  <div style={{
                    padding: '4px 10px',
                    background: `${estadoColor}22`,
                    color: estadoColor,
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    {a.estado.replace('_', ' ')}
                  </div>
                </div>

                {a.url_preview && (
                  <a href={a.url_preview} target="_blank" rel="noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px',
                    background: '#0a0a14',
                    border: '1px solid #2a2a40',
                    borderRadius: 8,
                    color: '#a0a0b8',
                    fontSize: 12,
                    textDecoration: 'none',
                    marginBottom: 10,
                  }}>
                    <i className="fas fa-external-link-alt" /> Ver material
                  </a>
                )}

                {a.comentario_cliente && (
                  <div style={{ marginBottom: 10, padding: 10, background: '#f5a62315', borderLeft: '3px solid #f5a623', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#f5a623', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Tu comentario</div>
                    <div style={{ fontSize: 13, color: '#e8e8f0' }}>{a.comentario_cliente}</div>
                  </div>
                )}

                {isPendiente && comentando !== a.id && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => aprobar(a.id)} disabled={busy === a.id} style={{
                      padding: '9px 16px',
                      background: 'linear-gradient(135deg, #00d97e, #11cdef)',
                      border: 'none', borderRadius: 8,
                      color: 'white', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                      <i className="fas fa-check" style={{ marginRight: 6 }} /> Aprobar
                    </button>
                    <button onClick={() => { setComentando(a.id); setComentario('') }} style={{
                      padding: '9px 16px',
                      background: 'transparent',
                      border: '1px solid #f5a623', borderRadius: 8,
                      color: '#f5a623', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                      <i className="fas fa-comment-dots" style={{ marginRight: 6 }} /> Pedir cambios
                    </button>
                  </div>
                )}

                {comentando === a.id && (
                  <div style={{ marginTop: 12 }}>
                    <textarea
                      value={comentario}
                      onChange={e => setComentario(e.target.value)}
                      placeholder="Que cambios queres? (mas detallado mejor)"
                      autoFocus
                      style={{
                        width: '100%', minHeight: 80, padding: 12,
                        background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 8,
                        color: '#e8e8f0', fontSize: 13, outline: 'none', resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => pedirCambios(a.id)} disabled={!comentario.trim() || busy === a.id} style={{
                        padding: '8px 14px',
                        background: comentario.trim() ? '#f5a623' : '#3a3a55',
                        border: 'none', borderRadius: 8,
                        color: 'white', fontSize: 12, fontWeight: 600,
                        cursor: comentario.trim() ? 'pointer' : 'not-allowed',
                      }}>
                        Enviar comentario
                      </button>
                      <button onClick={() => { setComentando(null); setComentario('') }} style={{
                        padding: '8px 14px',
                        background: 'transparent',
                        border: '1px solid #2a2a40', borderRadius: 8,
                        color: '#a0a0b8', fontSize: 12,
                        cursor: 'pointer',
                      }}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
