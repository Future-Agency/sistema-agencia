'use client'
import type { Cliente, ClientePortalConfig, EstrategiaSeccion, FunnelStage } from '@/lib/supabase'
import { FUNNEL_INFO, FunnelPill } from './ui'

type Props = { config: ClientePortalConfig | null; cliente: Cliente }

export default function PortalSeccionEstrategia({ config }: Props) {
  const tesis = config?.estrategia_tesis || config?.estrategia
  const stages: { k: FunnelStage; data: EstrategiaSeccion | null }[] = [
    { k: 'tofu', data: config?.estrategia_tofu || null },
    { k: 'mofu', data: config?.estrategia_mofu || null },
    { k: 'bofu', data: config?.estrategia_bofu || null },
  ]
  const tieneFunnel = stages.some(s => s.data)

  return (
    <div>
      <h1 className="fa-section-h1">Estrategia</h1>
      <p className="fa-section-sub">El plan que estamos ejecutando · revisalo cuando quieras</p>

      {tesis && (
        <div className="fa-card" style={{ marginBottom: 22 }}>
          <div className="fa-display-up" style={{ fontSize: 18, marginBottom: 14 }}>Tesis del trimestre</div>
          <div style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{tesis}</div>
        </div>
      )}

      {tieneFunnel && (
        <div style={{ display: 'grid', gap: 14, marginBottom: 22 }}>
          {stages.map(({ k, data }) => {
            if (!data) return null
            const info = FUNNEL_INFO[k]
            return (
              <div key={k} className="fa-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ height: 4, background: info.color }} />
                <div style={{ padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <FunnelPill stage={k} full />
                  </div>
                  <div className="fa-grid-2-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px', fontWeight: 600 }}>Qué hacemos</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--text)' }}>
                        {data.que_hacemos.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px', fontWeight: 600 }}>Qué medimos</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {data.kpis.map((m, i) => (
                          <span key={i} style={{ padding: '5px 10px', background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!tesis && !tieneFunnel && (
        <div className="fa-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          <i className="fas fa-chess" style={{ fontSize: 36, marginBottom: 12, color: 'var(--text-dim)' }} />
          <div>La estrategia se va a publicar pronto</div>
        </div>
      )}
    </div>
  )
}
