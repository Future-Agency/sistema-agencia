'use client'
import { useState } from 'react'
import { supabase, type ClienteSugerencia } from '@/lib/supabase'

type Props = {
  sugerencias: ClienteSugerencia[]
  clienteId: number
  onUpdate: () => void
  colorPrimario: string
}

const ESTADO_INFO: Record<string, { label: string; color: string }> = {
  nueva: { label: 'Nueva', color: '#5e72e4' },
  en_revision: { label: 'En revision', color: '#f5a623' },
  implementada: { label: 'Implementada', color: '#00d97e' },
  descartada: { label: 'Descartada', color: '#6a6a80' },
}

export default function PortalSeccionSugerencias({ sugerencias, clienteId, onUpdate, colorPrimario }: Props) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [success, setSuccess] = useState(false)

  async function enviar() {
    if (!texto.trim()) return
    setEnviando(true)
    await supabase.from('cliente_sugerencias').insert({
      cliente_id: clienteId,
      texto: texto.trim(),
      estado: 'nueva',
      visto_por_agencia: false,
    })
    setTexto('')
    setEnviando(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2500)
    onUpdate()
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Sugerencias y Mejoras</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 24 }}>Que te gustaria que mejoremos? Tu feedback es clave</p>

      <div style={{ padding: 20, background: '#14142a', border: `1px solid ${colorPrimario}30`, borderRadius: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          <i className="fas fa-lightbulb" style={{ color: colorPrimario, marginRight: 8 }} /> Nueva sugerencia
        </div>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Contanos que mejorarias del servicio, ideas de contenido, lo que sea..."
          style={{
            width: '100%', minHeight: 100, padding: 14,
            background: '#0a0a14', border: '1px solid #2a2a40', borderRadius: 8,
            color: '#e8e8f0', fontSize: 13, outline: 'none', resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          {success ? (
            <span style={{ fontSize: 12, color: '#00d97e' }}>
              <i className="fas fa-check-circle" style={{ marginRight: 5 }} /> Enviada! Vamos a leerla pronto
            </span>
          ) : <span />}
          <button
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            style={{
              padding: '10px 18px',
              background: texto.trim() && !enviando ? `linear-gradient(135deg, ${colorPrimario}, ${colorPrimario}aa)` : '#3a3a55',
              border: 'none', borderRadius: 8,
              color: 'white', fontSize: 13, fontWeight: 600,
              cursor: texto.trim() && !enviando ? 'pointer' : 'not-allowed',
            }}
          >
            <i className="fas fa-paper-plane" style={{ marginRight: 6 }} />
            {enviando ? 'Enviando...' : 'Enviar sugerencia'}
          </button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a0a0b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Tus sugerencias anteriores ({sugerencias.length})
        </h3>
        {sugerencias.length === 0 ? (
          <div style={{ padding: 28, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80', fontSize: 13 }}>
            Aun no enviaste sugerencias
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {sugerencias.map(s => {
              const info = ESTADO_INFO[s.estado] || ESTADO_INFO.nueva
              return (
                <div key={s.id} style={{ padding: 16, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#6a6a80' }}>
                      {new Date(s.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    <span style={{
                      padding: '3px 10px',
                      background: `${info.color}22`,
                      color: info.color,
                      borderRadius: 12,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>{info.label}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{s.texto}</div>
                  {s.respuesta_agencia && (
                    <div style={{ marginTop: 10, padding: 10, background: '#0a0a14', borderLeft: `3px solid ${colorPrimario}`, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: colorPrimario, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Respuesta del equipo</div>
                      <div style={{ fontSize: 12, color: '#e8e8f0' }}>{s.respuesta_agencia}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
