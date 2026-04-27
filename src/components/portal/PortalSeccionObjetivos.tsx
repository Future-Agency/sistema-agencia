'use client'
import type { ClienteObjetivo } from '@/lib/supabase'

type Props = { objetivos: ClienteObjetivo[] }

export default function PortalSeccionObjetivos({ objetivos }: Props) {
  return (
    <div>
      <h1 className="fa-section-h1">Objetivos del trimestre</h1>
      <p className="fa-section-sub">Cómo vamos contra lo que prometimos</p>

      {objetivos.length === 0 ? (
        <div className="fa-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          <i className="fas fa-bullseye" style={{ fontSize: 28, color: 'var(--text-dim)', marginBottom: 10 }} />
          <div>Sin objetivos cargados</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {objetivos.map(o => {
            const progreso = o.progreso ?? (o.estado === 'logrado' ? 100 : 0)
            const status = progreso >= 100 ? 'ok' : progreso >= 70 ? 'warn' : progreso >= 50 ? 'info' : 'bad'
            const color = status === 'ok' ? 'var(--ok)' : status === 'warn' ? 'var(--warn)' : status === 'info' ? 'var(--brand-blue)' : 'var(--bad)'
            return (
              <div key={o.id} className="fa-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {o.area && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, fontWeight: 600 }}>{o.area}</div>
                    )}
                    <div className="fa-display-up" style={{ fontSize: 18 }}>{o.titulo}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, fontFamily: 'var(--font-display)' }}>{progreso}%</div>
                    {(o.actual || o.meta) && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{o.actual || '-'} / {o.meta || '-'}</div>
                    )}
                  </div>
                </div>
                <div className="fa-bar"><i style={{ width: Math.min(progreso, 100) + '%', background: color }} /></div>
                {o.por_que && (
                  <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text)' }}>Por qué importa: </strong>{o.por_que}
                  </div>
                )}
                {o.resultado && (
                  <div style={{ marginTop: 10, padding: 10, background: 'var(--bg-1)', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--ok)', fontWeight: 600 }}>Resultado:</span> {o.resultado}
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
