'use client'
import type { ClienteObjetivo } from '@/lib/supabase'

type Props = { objetivos: ClienteObjetivo[]; colorPrimario: string }

export default function PortalSeccionObjetivos({ objetivos, colorPrimario }: Props) {
  const activos = objetivos.filter(o => o.estado === 'activo')
  const logrados = objetivos.filter(o => o.estado === 'logrado')

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Objetivos</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 24 }}>El norte que estamos persiguiendo y lo que ya conseguimos</p>

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: colorPrimario, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          <i className="fas fa-bullseye" style={{ marginRight: 8 }} /> En curso ({activos.length})
        </h3>
        {activos.length === 0 ? (
          <Empty />
        ) : activos.map(o => (
          <div key={o.id} style={{ padding: 18, background: '#14142a', border: `1px solid ${colorPrimario}30`, borderRadius: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{o.titulo}</div>
            {o.descripcion && <div style={{ fontSize: 13, color: '#a0a0b8', lineHeight: 1.6 }}>{o.descripcion}</div>}
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 8 }}>
              <i className="fas fa-calendar-day" style={{ marginRight: 6 }} />
              Iniciado el {fmt(o.fecha_inicio)}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#00d97e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          <i className="fas fa-trophy" style={{ marginRight: 8 }} /> Logrados ({logrados.length})
        </h3>
        {logrados.length === 0 ? (
          <Empty />
        ) : logrados.map(o => (
          <div key={o.id} style={{ padding: 18, background: '#14142a', border: '1px solid #00d97e30', borderRadius: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <i className="fas fa-check-circle" style={{ color: '#00d97e', fontSize: 16 }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{o.titulo}</span>
            </div>
            {o.descripcion && <div style={{ fontSize: 13, color: '#a0a0b8', lineHeight: 1.6 }}>{o.descripcion}</div>}
            {o.resultado && (
              <div style={{ marginTop: 10, padding: 10, background: '#0a0a14', borderRadius: 8, fontSize: 12 }}>
                <span style={{ color: '#00d97e', fontWeight: 600 }}>Resultado:</span> {o.resultado}
              </div>
            )}
            {o.fecha_logrado && (
              <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 8 }}>
                <i className="fas fa-flag-checkered" style={{ marginRight: 6 }} /> {fmt(o.fecha_logrado)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty() {
  return <div style={{ padding: 20, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, color: '#6a6a80', fontSize: 13, textAlign: 'center' }}>Aun no hay objetivos en este estado</div>
}

function fmt(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}
