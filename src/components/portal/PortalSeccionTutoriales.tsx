'use client'
import type { ClienteTutorial } from '@/lib/supabase'

type Props = { tutoriales: ClienteTutorial[]; colorPrimario: string }

const CATEGORIA_INFO: Record<string, { icon: string; label: string }> = {
  meta: { icon: 'fa-meta', label: 'Meta Ads' },
  crm: { icon: 'fa-address-book', label: 'CRM' },
  portal: { icon: 'fa-laptop', label: 'Portal' },
  pagos: { icon: 'fa-credit-card', label: 'Pagos' },
  contenido: { icon: 'fa-video', label: 'Contenido' },
}

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  return m ? m[1] : null
}

export default function PortalSeccionTutoriales({ tutoriales, colorPrimario }: Props) {
  const grupos = tutoriales.reduce((acc, t) => {
    const cat = t.categoria || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<string, ClienteTutorial[]>)

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Tutoriales</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 24 }}>Guias para sacarle el maximo provecho al servicio</p>

      {tutoriales.length === 0 ? (
        <div style={{ padding: 32, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80' }}>
          <i className="fas fa-graduation-cap" style={{ fontSize: 36, marginBottom: 12, color: '#3a3a55' }} />
          <div>Aun no se cargaron tutoriales</div>
        </div>
      ) : (
        Object.entries(grupos).map(([cat, items]) => {
          const info = CATEGORIA_INFO[cat] || { icon: 'fa-book', label: cat }
          return (
            <div key={cat} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: colorPrimario, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                <i className={`fas ${info.icon}`} style={{ marginRight: 8 }} /> {info.label}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {items.map(t => {
                  const ytId = getYoutubeId(t.url)
                  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null
                  return (
                    <a key={t.id} href={t.url} target="_blank" rel="noreferrer" style={{
                      display: 'block', textDecoration: 'none', color: 'inherit',
                      background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12,
                      overflow: 'hidden', transition: 'border-color 0.2s, transform 0.2s',
                    }} onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = colorPrimario + '55' }}
                       onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#1a1a2e' }}>
                      {thumb ? (
                        <div style={{ position: 'relative', paddingBottom: '56%', background: '#0a0a14' }}>
                          <img src={thumb} alt={t.titulo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.3)',
                          }}>
                            <div style={{
                              width: 50, height: 50, borderRadius: 25,
                              background: 'rgba(255,255,255,0.95)', color: '#0a0a14',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 18,
                            }}>
                              <i className="fas fa-play" style={{ marginLeft: 3 }} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: 140, background: `linear-gradient(135deg, ${colorPrimario}, ${colorPrimario}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fas fa-play-circle" style={{ fontSize: 40, color: 'white' }} />
                        </div>
                      )}
                      <div style={{ padding: 14 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{t.titulo}</div>
                        {t.descripcion && <div style={{ fontSize: 11, color: '#a0a0b8', lineHeight: 1.5 }}>{t.descripcion}</div>}
                      </div>
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
