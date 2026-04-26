'use client'
import type { ClienteAcceso } from '@/lib/supabase'

type Props = { accesos: ClienteAcceso[]; colorPrimario: string }

const TIPO_INFO: Record<string, { icon: string; label: string }> = {
  meta: { icon: 'fa-meta', label: 'Meta Ads' },
  crm: { icon: 'fa-address-book', label: 'CRM' },
  drive: { icon: 'fa-cloud', label: 'Drive' },
  web: { icon: 'fa-globe', label: 'Web' },
  email: { icon: 'fa-envelope', label: 'Email' },
}

export default function PortalSeccionAccesos({ accesos, colorPrimario }: Props) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Accesos</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 24 }}>Las cuentas y herramientas vinculadas a tu servicio</p>

      {accesos.length === 0 ? (
        <div style={{ padding: 32, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80' }}>
          <i className="fas fa-key" style={{ fontSize: 36, marginBottom: 12, color: '#3a3a55' }} />
          <div>Aun no se cargaron accesos</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {accesos.map(a => {
            const info = TIPO_INFO[a.tipo] || { icon: 'fa-link', label: a.tipo }
            return (
              <div key={a.id} style={{ padding: 18, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: a.notas ? 10 : 0 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${colorPrimario}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: colorPrimario, fontSize: 18,
                  }}>
                    <i className={`fas ${info.icon}`} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nombre}</div>
                    <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase' }}>{info.label}</div>
                    {a.usuario && <div style={{ fontSize: 12, color: '#a0a0b8', marginTop: 4 }}><i className="fas fa-user" style={{ marginRight: 5 }} />{a.usuario}</div>}
                  </div>
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" style={{
                      padding: '8px 14px',
                      background: '#0a0a14',
                      border: `1px solid ${colorPrimario}55`,
                      borderRadius: 8,
                      color: colorPrimario,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}>
                      <i className="fas fa-external-link-alt" style={{ marginRight: 5 }} /> Abrir
                    </a>
                  )}
                </div>
                {a.notas && (
                  <div style={{ padding: 10, background: '#0a0a14', borderRadius: 6, fontSize: 12, color: '#a0a0b8' }}>
                    <i className="fas fa-info-circle" style={{ marginRight: 5, color: '#6a6a80' }} />
                    {a.notas}
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
