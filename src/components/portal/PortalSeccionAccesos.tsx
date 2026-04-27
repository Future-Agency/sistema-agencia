'use client'
import type { ClienteAcceso } from '@/lib/supabase'
import { StatusDot } from './ui'

type Props = { accesos: ClienteAcceso[] }

const ICON_FALLBACK: Record<string, { icon: string; color: string }> = {
  meta: { icon: 'fa-meta', color: '#1877F2' },
  instagram: { icon: 'fa-instagram', color: '#E1306C' },
  whatsapp: { icon: 'fa-whatsapp', color: '#25D366' },
  google_ads: { icon: 'fa-google', color: '#4285F4' },
  tiktok: { icon: 'fa-tiktok', color: '#000000' },
  crm: { icon: 'fa-address-book', color: '#FF7A59' },
  drive: { icon: 'fa-google-drive', color: '#1FA463' },
  web: { icon: 'fa-globe', color: '#5e72e4' },
  email: { icon: 'fa-envelope', color: '#7d8db1' },
}

export default function PortalSeccionAccesos({ accesos }: Props) {
  return (
    <div>
      <h1 className="fa-section-h1">Accesos & Cuentas</h1>
      <p className="fa-section-sub">Quién tiene qué · estado de las integraciones</p>

      {accesos.length === 0 ? (
        <div className="fa-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
          <i className="fas fa-key" style={{ fontSize: 28, color: 'var(--text-dim)', marginBottom: 10 }} />
          <div>Aún no se cargaron accesos</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {accesos.map(a => {
            const fallback = ICON_FALLBACK[a.tipo] || { icon: 'fa-link', color: 'var(--brand-blue)' }
            const icon = a.icon || fallback.icon
            const color = a.color || fallback.color
            const plataforma = a.plataforma || a.nombre
            const cuenta = a.cuenta || a.usuario || '—'
            const estado = a.estado || 'conectado'
            const esConectado = estado === 'conectado'
            const isFa = icon.startsWith('fa-')
            // Use 'fab' for brand icons, 'fas' for solid generic
            const brandIcons = ['fa-meta', 'fa-instagram', 'fa-whatsapp', 'fa-google', 'fa-tiktok', 'fa-google-drive', 'fa-hubspot']
            const iconClass = brandIcons.includes(icon) ? 'fab' : 'fas'

            return (
              <div key={a.id} className="fa-card fa-card-tight" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`${iconClass} ${icon}`} style={{ color: '#fff', fontSize: 18 }} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{plataforma}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{cuenta}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusDot kind={esConectado ? 'ok' : 'warn'} />
                  <span style={{ fontSize: 12, color: esConectado ? 'var(--ok)' : 'var(--warn)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{estado}</span>
                </div>
                {a.url ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="fa-btn fa-btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>{esConectado ? 'Gestionar' : 'Reconectar'}</a>
                ) : (
                  <button className="fa-btn fa-btn-ghost" style={{ fontSize: 12 }}>{esConectado ? 'Gestionar' : 'Reconectar'}</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
