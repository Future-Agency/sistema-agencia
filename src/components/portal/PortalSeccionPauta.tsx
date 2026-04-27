'use client'
import { useState } from 'react'
import type { AdAccount, ClientePortalConfig } from '@/lib/supabase'
import { Delta, FunnelPill, fmtMoney, fmtMoneyShort, fmtNum } from './ui'

type Props = { adAccounts: AdAccount[]; config: ClientePortalConfig | null }

export default function PortalSeccionPauta({ adAccounts, config }: Props) {
  const [period, setPeriod] = useState<'7d' | '15d' | '30d'>('30d')
  const tc = config?.top_creativo
  const benchmark = config?.benchmark

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
      value: acc.value + (m.purchase_value || 0),
    }
  }, { spend: 0, impressions: 0, clicks: 0, purchases: 0, leads: 0, messages: 0, value: 0 })

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const roas = totals.spend > 0 ? totals.value / totals.spend : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 className="fa-section-h1">Pauta Publicitaria</h1>
          <p className="fa-section-sub" style={{ marginBottom: 0 }}>Resultados reales — y qué creativo está ganando.</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
          {(['7d', '15d', '30d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '7px 14px',
              background: period === p ? 'var(--brand-blue)' : 'transparent',
              border: 'none', borderRadius: 7,
              color: period === p ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              {p === '7d' ? '7 días' : p === '15d' ? '15 días' : '30 días'}
            </button>
          ))}
        </div>
      </div>

      {/* TOP CREATIVO DEL MES */}
      {tc && (
        <div className="fa-card" style={{ marginBottom: 22, padding: 0, overflow: 'hidden', border: '1px solid rgba(0,217,126,0.3)' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--ok), var(--brand-cyan))' }} />
          <div className="fa-grid-top-creativo" style={{ padding: 22, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 22 }}>
            <div className="fa-stripes" style={{ aspectRatio: '9/16', borderRadius: 12, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: 56, height: 56, borderRadius: 50, background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-play" style={{ fontSize: 22, color: '#fff', marginLeft: 3 }} />
                </div>
                {tc.thumb_label && <div style={{ fontSize: 10, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{tc.thumb_label}</div>}
              </div>
              {tc.funnel && <div style={{ position: 'absolute', top: 10, left: 10 }}><FunnelPill stage={tc.funnel} /></div>}
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-trophy" /> Top creativo del mes
              </div>
              <div className="fa-display-up" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 12, color: 'var(--text)' }}>{tc.titulo}</div>
              {tc.angle && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text)' }}>Por qué funcionó:</strong> {tc.angle}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
                <Mini label="Vistas" value={fmtNum(tc.metricas.vistas)} />
                <Mini label="Compras" value={tc.metricas.compras.toString()} accent="var(--ok)" />
                <Mini label="Valor" value={fmtMoneyShort(tc.metricas.valor)} accent="var(--ok)" />
                <Mini label="ROAS" value={`${tc.metricas.roas.toFixed(1)}x`} accent="var(--ok)" />
                <Mini label="CTR" value={`${tc.metricas.ctr}%`} />
              </div>

              <button className="fa-btn fa-btn-primary"><i className="fas fa-rotate-right" /> Replicar este ángulo</button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Kpi label="Inversión" value={fmtMoneyShort(totals.spend)} icon="fa-dollar-sign" />
        <Kpi label="Valor compras" value={fmtMoneyShort(totals.value)} icon="fa-gem" accent="var(--ok)" />
        <Kpi label="ROAS" value={`${roas.toFixed(2)}x`} icon="fa-chart-line" accent={roas > 4 ? 'var(--ok)' : 'var(--warn)'} hero />
        <Kpi label="Compras" value={totals.purchases.toString()} icon="fa-shopping-cart" accent="var(--ok)" />
        <Kpi label="Leads" value={totals.leads.toString()} icon="fa-user-plus" />
        <Kpi label="CTR" value={`${ctr.toFixed(2)}%`} icon="fa-percent" accent={ctr > 2 ? 'var(--ok)' : 'var(--warn)'} />
        <Kpi label="Mensajes" value={totals.messages.toString()} icon="fa-comment" />
        <Kpi label="Impresiones" value={fmtNum(totals.impressions)} icon="fa-eye" />
      </div>

      {/* Benchmark */}
      {benchmark?.ctr && benchmark?.roas && (
        <div className="fa-card" style={{ marginBottom: 22, display: 'flex', gap: 22, alignItems: 'center', padding: '16px 22px', flexWrap: 'wrap' }}>
          <i className="fas fa-trophy" style={{ color: 'var(--brand-cyan)', fontSize: 20 }} />
          <div style={{ flex: 1, minWidth: 250 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Comparativa de rubro · Retail Argentina</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              Tu CTR del <strong>{benchmark.ctr.tu}%</strong> está <strong style={{ color: 'var(--ok)' }}>+{Math.round((benchmark.ctr.tu / benchmark.ctr.promedio - 1) * 100)}%</strong> arriba del promedio · Tu ROAS de <strong>{benchmark.roas.tu}x</strong> está <strong style={{ color: 'var(--ok)' }}>+{Math.round((benchmark.roas.tu / benchmark.roas.promedio - 1) * 100)}%</strong> arriba del promedio
            </div>
          </div>
        </div>
      )}

      {/* Cuentas por funnel */}
      <div style={{ marginBottom: 12 }}><div className="fa-display-up" style={{ fontSize: 18 }}>Por cuenta publicitaria</div></div>
      {adAccounts.length === 0 ? (
        <div className="fa-card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          <i className="fas fa-rectangle-ad" style={{ fontSize: 36, marginBottom: 12, color: 'var(--text-dim)' }} />
          <div>Aún no hay cuentas publicitarias conectadas</div>
        </div>
      ) : adAccounts.map(a => {
        const m = getMetrics(a)
        const accCtr = (m.impressions || 0) > 0 ? ((m.clicks || 0) / (m.impressions || 1)) * 100 : 0
        const accRoas = (m.spend || 0) > 0 ? (m.purchase_value || 0) / (m.spend || 1) : 0
        return (
          <div key={a.id} className="fa-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {a.funnel && <FunnelPill stage={a.funnel} />}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{a.account_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.currency} · Meta Ads</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              <Mini label="Inversión" value={fmtMoneyShort(m.spend || 0)} />
              <Mini label="CTR" value={`${accCtr.toFixed(2)}%`} accent={accCtr > 2 ? 'var(--ok)' : 'var(--warn)'} />
              <Mini label="Valor" value={fmtMoneyShort(m.purchase_value || 0)} accent="var(--ok)" />
              <Mini label="ROAS" value={`${accRoas.toFixed(2)}x`} accent={accRoas > 4 ? 'var(--ok)' : 'var(--warn)'} />
              {(m.purchases || 0) > 0 && <Mini label="Compras" value={(m.purchases || 0).toString()} />}
              {(m.leads || 0) > 0 && <Mini label="Leads" value={(m.leads || 0).toString()} />}
              {(m.messages || 0) > 0 && <Mini label="Mensajes" value={(m.messages || 0).toString()} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Kpi({ label, value, icon, accent, hero }: { label: string; value: string; icon: string; accent?: string; hero?: boolean }) {
  return (
    <div className="fa-card fa-card-tight" style={{ background: hero ? 'rgba(36,56,255,0.08)' : 'var(--card)', border: hero ? '1px solid rgba(36,56,255,0.4)' : undefined }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, fontWeight: 600 }}>
        <i className={`fas ${icon}`} style={{ color: accent || 'var(--brand-blue)', marginRight: 6 }} />{label}
      </div>
      <div style={{ fontSize: hero ? 26 : 20, fontWeight: 700, color: accent || 'var(--text)' }}>{value}</div>
    </div>
  )
}

function Mini({ label, value, accent, delta }: { label: string; value: string; accent?: string; delta?: number }) {
  return (
    <div style={{ padding: 10, background: 'var(--bg-1)', borderRadius: 8 }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3, letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: accent || 'var(--text)' }}>{value}</div>
        {delta !== undefined && <Delta value={delta} />}
      </div>
    </div>
  )
}
