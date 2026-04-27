'use client'
import type { ClientePago } from '@/lib/supabase'
import { fmtMoney } from './ui'

type Props = { pagos: ClientePago[] }

export default function PortalSeccionPagos({ pagos }: Props) {
  const pendientes = pagos.filter(p => p.estado === 'pendiente').sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  const proximo = pendientes[0]
  const historial = pagos.filter(p => p.estado !== 'pendiente').sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return (
    <div>
      <h1 className="fa-section-h1">Pagos & Facturación</h1>
      <p className="fa-section-sub">Lo que cobramos · cuándo · qué incluye</p>

      {proximo && (
        <div className="fa-card" style={{ marginBottom: 22, background: 'var(--brand-grad)', color: '#fff', border: 'none' }}>
          <div style={{ fontSize: 11, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, fontWeight: 600 }}>Próximo cobro</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{fmtMoney(proximo.monto, proximo.moneda)}</div>
              <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>{proximo.concepto}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Vence el</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{new Date(proximo.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
        </div>
      )}

      <div className="fa-card">
        <div className="fa-display-up" style={{ fontSize: 18, marginBottom: 14 }}>Historial</div>
        {historial.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 28 }}>Sin movimientos aún</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px 10px 0', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Fecha</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Concepto</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Monto</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Estado</th>
                  <th style={{ textAlign: 'right', padding: '10px 0 10px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Factura</th>
                </tr>
              </thead>
              <tbody>
                {historial.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px 12px 0', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                    <td style={{ padding: '12px 8px' }}>{p.concepto}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(p.monto, p.moneda)}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <span style={{ padding: '3px 9px', background: p.estado === 'pagado' ? 'rgba(0,217,126,0.15)' : 'rgba(245,166,35,0.15)', color: p.estado === 'pagado' ? 'var(--ok)' : 'var(--warn)', borderRadius: 10, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{p.estado}</span>
                    </td>
                    <td style={{ padding: '12px 0 12px 8px', textAlign: 'right' }}>
                      {p.factura ? (
                        <a href="#" style={{ color: 'var(--brand-blue-soft)', fontSize: 12, textDecoration: 'none' }}><i className="fas fa-download" /> {p.factura}</a>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
