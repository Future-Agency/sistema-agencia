'use client'
import type { ClienteTutorial } from '@/lib/supabase'

type Props = { tutoriales: ClienteTutorial[] }

function getYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  return m ? m[1] : null
}

export default function PortalSeccionTutoriales({ tutoriales }: Props) {
  return (
    <div>
      <h1 className="fa-section-h1">Tutoriales & Guías</h1>
      <p className="fa-section-sub">Aprendé a aprovechar todo lo que el portal puede hacer por vos</p>

      {tutoriales.length === 0 ? (
        <div className="fa-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          <i className="fas fa-graduation-cap" style={{ fontSize: 28, color: 'var(--text-dim)', marginBottom: 10 }} />
          <div>Aún no se cargaron tutoriales</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 14 }}>
          {tutoriales.map(t => {
            const ytId = getYoutubeId(t.url)
            const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null
            const tut = t as unknown as { duracion?: string }
            return (
              <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="fa-card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div className="fa-stripes" style={{ aspectRatio: '16/9', position: 'relative' }}>
                  {thumb && <img src={thumb} alt={t.titulo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <div style={{ position: 'absolute', inset: 0, background: thumb ? 'rgba(0,0,0,0.3)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 54, height: 54, borderRadius: 50, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fas fa-play" style={{ color: '#fff', fontSize: 18, marginLeft: 3 }} />
                    </div>
                  </div>
                  {tut.duracion && (
                    <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '3px 7px', background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 5, fontSize: 10, fontFamily: 'var(--font-mono)' }}>{tut.duracion}</div>
                  )}
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t.titulo}</div>
                  {t.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.descripcion}</div>}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
