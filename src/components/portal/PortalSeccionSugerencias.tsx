'use client'
import { useState } from 'react'
import { supabase, type ClienteSugerencia } from '@/lib/supabase'

type Props = {
  sugerencias: ClienteSugerencia[]
  clienteId: number
  onUpdate: () => void
}

const OPTS = [
  { id: 'idea', label: 'Tengo una idea', icon: 'fa-lightbulb', color: 'var(--warn)' },
  { id: 'feedback', label: 'Feedback general', icon: 'fa-comment', color: 'var(--brand-blue)' },
  { id: 'producto', label: 'Producto / oferta nueva', icon: 'fa-rocket', color: 'var(--brand-cyan)' },
  { id: 'queja', label: 'Algo que no me gustó', icon: 'fa-triangle-exclamation', color: 'var(--bad)' },
]

export default function PortalSeccionSugerencias({ sugerencias, clienteId, onUpdate }: Props) {
  const [tipo, setTipo] = useState('idea')
  const [texto, setTexto] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true)
    const opt = OPTS.find(o => o.id === tipo)
    const tipoLabel = opt ? opt.label : tipo
    await supabase.from('cliente_sugerencias').insert({
      cliente_id: clienteId,
      texto: `[${tipoLabel}] ${texto.trim()}`,
      estado: 'nueva',
      visto_por_agencia: false,
    })
    setTexto('')
    setEnviando(false)
    setEnviado(true)
    onUpdate()
  }

  return (
    <div>
      <h1 className="fa-section-h1">Sugerencias & Pedidos</h1>
      <p className="fa-section-sub">Tu input es oro — el equipo lo lee todos los lunes</p>

      {enviado ? (
        <div className="fa-card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 64, height: 64, borderRadius: 50, background: 'rgba(0,217,126,0.15)', color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <i className="fas fa-check" style={{ fontSize: 28 }} />
          </div>
          <div className="fa-display-up" style={{ fontSize: 22, marginBottom: 8 }}>¡Recibido!</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 18 }}>Te respondemos por WhatsApp en menos de 24hs.</div>
          <button className="fa-btn fa-btn-ghost" onClick={() => { setEnviado(false); setTexto('') }}>Mandar otro</button>
        </div>
      ) : (
        <div className="fa-card" style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, fontWeight: 600 }}>¿De qué se trata?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 10, marginBottom: 20 }}>
            {OPTS.map(o => {
              const a = tipo === o.id
              return (
                <button key={o.id} onClick={() => setTipo(o.id)} style={{ padding: 14, background: a ? `color-mix(in srgb, ${o.color} 12%, transparent)` : 'var(--bg-1)', border: `1px solid ${a ? o.color : 'var(--border-2)'}`, borderRadius: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, color: 'var(--text)' }}>
                  <i className={`fas ${o.icon}`} style={{ color: o.color, fontSize: 18 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{o.label}</span>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, fontWeight: 600 }}>Contanos</div>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Lo más detallado posible — qué pensás, ejemplos, links..." style={{ width: '100%', minHeight: 140, padding: 14, background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} />
          <button className="fa-btn fa-btn-primary" disabled={!texto.trim() || enviando} onClick={enviar}>
            {enviando ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Enviar al equipo</>}
          </button>
        </div>
      )}

      {sugerencias.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
            Tus sugerencias anteriores ({sugerencias.length})
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {sugerencias.map(s => {
              const c = s.estado === 'implementada' ? 'var(--ok)' : s.estado === 'descartada' ? 'var(--text-dim)' : s.estado === 'en_revision' ? 'var(--warn)' : 'var(--brand-blue)'
              return (
                <div key={s.id} className="fa-card fa-card-tight">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(s.created_at).toLocaleDateString('es-AR')}</div>
                    <span style={{ padding: '3px 10px', background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c, borderRadius: 12, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{s.estado.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{s.texto}</div>
                  {s.respuesta_agencia && (
                    <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-1)', borderLeft: `3px solid ${c}`, borderRadius: 6, fontSize: 12 }}>
                      <strong style={{ color: c }}>Respuesta del equipo:</strong> {s.respuesta_agencia}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
