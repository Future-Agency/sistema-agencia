'use client'
import { useState } from 'react'
import type { AdAccount } from '@/lib/supabase'

type Props = { adAccounts: AdAccount[]; colorPrimario: string }

export default function PortalSeccionPauta({ adAccounts, colorPrimario }: Props) {
  const [period, setPeriod] = useState<'7d' | '15d' | '30d'>('30d')

  function getMetrics(a: AdAccount) {
    const m = period === '7d' ? a.metrics_7d : period === '15d' ? a.metrics_15d : a.metrics_30d
    return m || {}
  }

  const totals = adAccounts.reduce((acc, a) => {
    const m = getMetrics(a)
    return {
      spend: acc.spend + (m.spend || 0),
      impressions: acc.impressions + (m.impressions || 0),
      clicks: acc.clicks + (m.clicks || 0),
      purchases: acc.purchases + (m.purchases || 0),
      leads: acc.leads + (m.leads || 0),
      messages: acc.messages + (m.messages || 0),
      purchase_value: acc.purchase_value + (m.purchase_value || 0),
    }
  }, { spend: 0, impressions: 0, clicks: 0, purchases: 0, leads: 0, messages: 0, purchase_value: 0 })

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const roas = totals.spend > 0 ? totals.purchase_value / totals.spend : 0
  const lastSync = adAccounts.reduce((latest, a) => {
    if (!a.last_synced_at) return latest
    if (!latest || a.last_synced_at > latest) return a.last_synced_at
    return latest
  }, '' as string)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>Pauta Publicitaria</h2>
          <p style={{ fontSize: 13, color: '#a0a0b8', margin: 0 }}>Resultados reales de tus campañas de Meta Ads</p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 10, padding: 4 }}>
          {(['7d', '15d', '30d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '6px 14px',
              background: period === p ? colorPrimario : 'transparent',
              border: 'none', borderRadius: 7,
              color: period === p ? 'white' : '#a0a0b8',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}>
              {p === '7d' ? '7 dias' : p === '15d' ? '15 dias' : '30 dias'}
            </button>
          ))}
        </div>
      </div>

      {adAccounts.length === 0 ? (
        <div style={{ padding: 40, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, textAlign: 'center', color: '#6a6a80' }}>
          <i className="fas fa-rectangle-ad" style={{ fontSize: 36, marginBottom: 12, color: '#3a3a55' }} />
          <div>Aun no hay cuentas publicitarias conectadas</div>
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Kpi label="Inversion" value={`$${formatNum(totals.spend)}`} icon="fa-dollar-sign" color={colorPrimario} />
            <Kpi label="Impresiones" value={formatNum(totals.impressions)} icon="fa-eye" color="#11cdef" />
            <Kpi label="Clicks" value={formatNum(totals.clicks)} icon="fa-mouse-pointer" color="#8965e0" />
            <Kpi label="CTR" value={`${ctr.toFixed(2)}%`} icon="fa-percent" color={ctr > 2 ? '#00d97e' : '#f5a623'} />
            {totals.purchases > 0 && <Kpi label="Compras" value={formatNum(totals.purchases)} icon="fa-shopping-cart" color="#00d97e" />}
            {totals.purchase_value > 0 && <Kpi label="Valor Compras" value={`$${formatNum(totals.purchase_value)}`} icon="fa-gem" color="#00d97e" />}
            {roas > 0 && <Kpi label="ROAS" value={`${roas.toFixed(2)}x`} icon="fa-chart-line" color={roas > 2 ? '#00d97e' : '#f5a623'} />}
            {totals.leads > 0 && <Kpi label="Leads" value={formatNum(totals.leads)} icon="fa-user-plus" color={colorPrimario} />}
            {totals.messages > 0 && <Kpi label="Mensajes" value={formatNum(totals.messages)} icon="fa-comment" color="#8965e0" />}
          </div>

          {lastSync && (
            <div style={{ fontSize: 11, color: '#6a6a80', marginBottom: 16, textAlign: 'right' }}>
              <i className="fas fa-sync-alt" style={{ marginRight: 5 }} />
              Ultima actualizacion: {new Date(lastSync).toLocaleString('es-AR')}
            </div>
          )}

          {/* Cuentas */}
          {adAccounts.map(a => {
            const m = getMetrics(a)
            const accCtr = (m.impressions || 0) > 0 ? ((m.clicks || 0) / (m.impressions || 1)) * 100 : 0
            const accRoas = (m.spend || 0) > 0 ? (m.purchase_value || 0) / (m.spend || 1) : 0
            return (
              <div key={a.id} style={{ padding: 18, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{a.account_name}</div>
                    <div style={{ fontSize: 11, color: '#6a6a80' }}>{a.currency} · {a.platform}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                  <Mini label="Inversion" value={`$${formatNum(m.spend || 0)}`} />
                  <Mini label="Impresiones" value={formatNum(m.impressions || 0)} />
                  <Mini label="Clicks" value={formatNum(m.clicks || 0)} />
                  <Mini label="CTR" value={`${accCtr.toFixed(2)}%`} />
                  {(m.purchases || 0) > 0 && <Mini label="Compras" value={formatNum(m.purchases || 0)} />}
                  {(m.purchase_value || 0) > 0 && <Mini label="Valor" value={`$${formatNum(m.purchase_value || 0)}`} />}
                  {accRoas > 0 && <Mini label="ROAS" value={`${accRoas.toFixed(2)}x`} accent={accRoas > 2 ? '#00d97e' : '#f5a623'} />}
                  {(m.leads || 0) > 0 && <Mini label="Leads" value={formatNum(m.leads || 0)} />}
                  {(m.messages || 0) > 0 && <Mini label="Mensajes" value={formatNum(m.messages || 0)} />}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{ padding: 14, background: '#14142a', border: '1px solid #1a1a2e', borderRadius: 12 }}>
      <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        <i className={`fas ${icon}`} style={{ color, marginRight: 6 }} /> {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ padding: 10, background: '#0a0a14', borderRadius: 8 }}>
      <div style={{ fontSize: 9, color: '#6a6a80', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent || '#e8e8f0' }}>{value}</div>
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toString()
}
