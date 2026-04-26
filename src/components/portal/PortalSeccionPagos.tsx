'use client'
import type { ClientePago, ClientePortalConfig } from '@/lib/supabase'

type Props = { pagos: ClientePago[]; config: ClientePortalConfig | null; colorPrimario: string }

const ESTADO_INFO: Record<string, { label: string; color: string; icon: string }> = {
  pagado: { label: 'Pagado', color: '#00d97e', icon: 'fa-check-circle' },
  pendiente: { label: 'Pendiente', color: '#f5a623', icon: 'fa-clock' },
  vencido: { label: 'Vencido', color: '#f5365c', icon: 'fa-exclamation-circle' },
}

export default function PortalSeccionPagos({ pagos, config, colorPrimario }: Props) {
  const proximoPago = pagos.find(p => p.estado === 'pendiente')
  const totalPagado = pagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.monto, 0)
  const cantidadPagos = pagos.filter(p => p.estado === 'pagado').length

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Pagos</h2>
      <p style={{ fontSize: 13, color: '#a0a0b8', marginTop: 0, marginBottom: 24 }}>Tu historial de pagos y proximos vencimientos</p>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {config?.fecha_inicio_servicio && (
          <Card icon="fa-flag" label="Inicio del servicio" value={fmt(config.fecha_inicio_servicio)} color={colorPrimario} />
        )}
        {config?.monto_mensual && (
          <Card icon="fa-money-bill" label="Mensualidad" value={`${config.moneda} ${formatNum(config.monto_mensual)}`} color={colorPrimario} />
        )}
        <Card icon="fa-receipt" label="Pagos realizados" value={cantidadPagos} color="#00d97e" />
        {totalPagado > 0 && (
          <Card icon="fa-coins" label="Total acumulado" value={`$${formatNum(totalPagado)}`} color="#00d97e" />
        )}
      </div>

      {/* Proximo pago */}
      {proximoPago && (
        <div style={{
          padding: 22,
          background: `linear-gradient(135deg, ${colorPrimario}25, ${colorPrimario}10)`,
          border: `1px solid ${colorPrimario}55`,
          borderRadius: 14,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: colorPrimario, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
                <i className="fas fa-calendar-day" style={{ marginRight: 6 }} /> Proximo pago
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 2 }}>
                {proximoPago.moneda} ${formatNum(proximoPago.monto)}
              </div>
              <div style={{ fontSize: 13, color: '#a0a0b8' }}>{proximoPago.concepto || 'Servicio mensual'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase' }}>Vence</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(proximoPago.fecha)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a0a0b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Historial completo
      </h3>
      {pagos.length === 0 ? (
        <div style={{ padding: 28, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80' }}>
          Sin movimientos aun
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {pagos.map(p => {
            const info = ESTADO_INFO[p.estado] || ESTADO_INFO.pendiente
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: 14,
                background: '#14142a',
                border: '1px solid #1a1a2e',
                borderRadius: 10,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${info.color}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: info.color, fontSize: 14,
                  flexShrink: 0,
                }}>
                  <i className={`fas ${info.icon}`} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.concepto || 'Pago de servicio'}</div>
                  <div style={{ fontSize: 11, color: '#6a6a80' }}>
                    {fmt(p.fecha)}
                    {p.metodo && ` · ${p.metodo}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.moneda} ${formatNum(p.monto)}</div>
                  <div style={{ fontSize: 10, color: info.color, fontWeight: 600, textTransform: 'uppercase' }}>{info.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Card({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  return (
    <div style={{ padding: 14, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <i className={`fas ${icon}`} style={{ color }} /> {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatNum(n: number): string {
  return new Intl.NumberFormat('es-AR').format(Math.round(n))
}
