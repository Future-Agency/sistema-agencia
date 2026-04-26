'use client'
import type { ClienteCalendario } from '@/lib/supabase'

type Props = { calendario: ClienteCalendario[]; colorPrimario: string }

const TIPO_ICON: Record<string, { icon: string; color: string }> = {
  reel: { icon: 'fa-film', color: '#5e72e4' },
  historia: { icon: 'fa-book-open', color: '#f5a623' },
  carrousel: { icon: 'fa-layer-group', color: '#8965e0' },
  anuncio: { icon: 'fa-bullhorn', color: '#f5365c' },
  guion: { icon: 'fa-scroll', color: '#11cdef' },
  post: { icon: 'fa-image', color: '#00d97e' },
}

export default function PortalSeccionCalendario({ calendario, colorPrimario }: Props) {
  // Agrupar por mes
  const grupos = calendario.reduce((acc, item) => {
    const key = item.fecha.substring(0, 7)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, ClienteCalendario[]>)

  const grupoKeys = Object.keys(grupos).sort()
  const hoy = new Date().toISOString().substring(0, 10)

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Calendario de Contenidos</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 24 }}>Programacion de tu contenido en redes sociales</p>

      {calendario.length === 0 ? (
        <div style={{ padding: 32, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80' }}>
          <i className="fas fa-calendar-times" style={{ fontSize: 36, marginBottom: 12, color: '#3a3a55' }} />
          <div>Sin publicaciones programadas todavia</div>
        </div>
      ) : grupoKeys.map(mes => (
        <div key={mes} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: colorPrimario, textTransform: 'capitalize', marginBottom: 12 }}>
            {new Date(mes + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {grupos[mes].map(item => {
              const t = TIPO_ICON[item.tipo || ''] || { icon: 'fa-calendar', color: colorPrimario }
              const yaPaso = item.fecha < hoy
              const esHoy = item.fecha === hoy
              const publicado = item.estado === 'publicado'
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: 14,
                  background: esHoy ? `${colorPrimario}15` : '#14142a',
                  border: `1px solid ${esHoy ? colorPrimario + '55' : '#1a1a2e'}`,
                  borderRadius: 12,
                  opacity: yaPaso && !publicado ? 0.5 : 1,
                }}>
                  <div style={{
                    width: 52, height: 52,
                    background: '#0a0a14',
                    borderRadius: 10,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    border: `1px solid ${esHoy ? colorPrimario : '#1a1a2e'}`,
                  }}>
                    <div style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase' }}>
                      {new Date(item.fecha).toLocaleDateString('es-AR', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: esHoy ? colorPrimario : '#e8e8f0' }}>
                      {new Date(item.fecha).getDate()}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <i className={`fas ${t.icon}`} style={{ color: t.color, fontSize: 12 }} />
                      <span style={{ fontSize: 10, color: t.color, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>{item.tipo}</span>
                      {esHoy && <span style={{ fontSize: 10, color: colorPrimario, fontWeight: 700 }}>HOY</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.titulo}</div>
                    {item.descripcion && <div style={{ fontSize: 12, color: '#a0a0b8' }}>{item.descripcion}</div>}
                  </div>

                  <div style={{
                    padding: '4px 10px',
                    background: publicado ? '#00d97e22' : item.estado === 'cancelado' ? '#f5365c22' : `${colorPrimario}22`,
                    color: publicado ? '#00d97e' : item.estado === 'cancelado' ? '#f5365c' : colorPrimario,
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>
                    {item.estado}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
