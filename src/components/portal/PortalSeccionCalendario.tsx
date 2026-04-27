'use client'
import { useState } from 'react'
import type { ClienteCalendario } from '@/lib/supabase'
import { FUNNEL_INFO, FunnelPill, TipoBadge } from './ui'

type Props = { calendario: ClienteCalendario[] }

export default function PortalSeccionCalendario({ calendario }: Props) {
  const [vista, setVista] = useState<'mes' | 'lista'>('mes')

  // Calcular el mes actual basado en items
  const ahora = new Date()
  const mesActual = ahora.getMonth()
  const yearActual = ahora.getFullYear()
  const ultimoDia = new Date(yearActual, mesActual + 1, 0).getDate()
  const dias = Array.from({ length: ultimoDia }, (_, i) => i + 1)

  const eventosPorDia: Record<number, ClienteCalendario[]> = {}
  calendario.forEach(e => {
    const f = new Date(e.fecha)
    if (f.getMonth() === mesActual && f.getFullYear() === yearActual) {
      const d = f.getDate()
      eventosPorDia[d] = eventosPorDia[d] || []
      eventosPorDia[d].push(e)
    }
  })

  const hoy = ahora.getDate()
  const nombreMes = ahora.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const sortedLista = [...calendario].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="fa-section-h1">Calendario</h1>
          <p className="fa-section-sub" style={{ marginBottom: 0 }}>Qué publicamos · qué está en producción · qué viene</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
          {(['mes', 'lista'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '7px 14px', background: vista === v ? 'var(--brand-blue)' : 'transparent', border: 'none', borderRadius: 7, color: vista === v ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{v === 'mes' ? 'Mes' : 'Lista'}</button>
          ))}
        </div>
      </div>

      {vista === 'mes' ? (
        <div className="fa-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div className="fa-display-up" style={{ fontSize: 18, textTransform: 'capitalize' }}>{nombreMes}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              {Object.entries(FUNNEL_INFO).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: v.color, borderRadius: 50 }} />{v.short}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
              <div key={d} style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', padding: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d}</div>
            ))}
            {dias.map(d => {
              const evs = eventosPorDia[d] || []
              return (
                <div key={d} style={{ aspectRatio: '1', background: 'var(--bg-1)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: d === hoy ? '1px solid var(--brand-blue)' : '1px solid transparent' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>{d}</div>
                  {evs.slice(0, 2).map((e, i) => {
                    const c = e.funnel ? FUNNEL_INFO[e.funnel].color : 'var(--text-dim)'
                    return (
                      <div key={i} style={{ padding: '2px 4px', background: `${c}33`, borderLeft: `2px solid ${c}`, borderRadius: 3, fontSize: 9, marginBottom: 2, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.titulo}
                      </div>
                    )
                  })}
                  {evs.length > 2 && <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{evs.length - 2}</div>}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedLista.map(e => {
            const c = e.funnel ? FUNNEL_INFO[e.funnel].color : 'var(--text-dim)'
            return (
              <div key={e.id} className="fa-card fa-card-tight" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: 60, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{new Date(e.fecha).toLocaleDateString('es-AR', { month: 'short' })}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{new Date(e.fecha).getDate()}</div>
                </div>
                <div style={{ width: 3, alignSelf: 'stretch', background: c, borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    {e.tipo && <TipoBadge tipo={e.tipo} />}
                    <FunnelPill stage={e.funnel} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {e.estado}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.titulo}</div>
                </div>
              </div>
            )
          })}
          {sortedLista.length === 0 && (
            <div className="fa-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
              <i className="fas fa-calendar-times" style={{ fontSize: 28, color: 'var(--text-dim)', marginBottom: 10 }} />
              <div>Sin publicaciones en el calendario</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
