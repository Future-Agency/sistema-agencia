import type { Cliente, Owner, AdAccount, PeriodMetrics } from './supabase'

type Params = {
  cliente: Cliente
  owner?: Owner
  cuentas: AdAccount[]
  period: '7d' | '15d' | '30d'
}

function extractMetrics(acc: AdAccount, period: '7d' | '15d' | '30d'): PeriodMetrics {
  const m = period === '7d' ? acc.metrics_7d : period === '15d' ? acc.metrics_15d : acc.metrics_30d
  if (m && Object.keys(m).length > 0) return m
  return {
    spend: acc.spend, impressions: acc.impressions, clicks: acc.clicks,
    ctr: acc.ctr, cpc: acc.cpc, messages: acc.messages,
    purchases: acc.purchases, leads: acc.leads, purchase_value: 0,
  }
}

const fmtNum = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0)
const fmtMoney = (n: number, cur = 'ARS') => new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n || 0)
const fmtPct = (n: number) => (n || 0).toFixed(2) + '%'
const fmtDec = (n: number) => (n || 0).toFixed(2)

export function generarReportePDF({ cliente, owner, cuentas, period }: Params) {
  const periodLabel = period === '7d' ? 'Últimos 7 días' : period === '15d' ? 'Últimos 15 días' : 'Últimos 30 días'
  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Totales
  let spend = 0, impressions = 0, clicks = 0, messages = 0, purchases = 0, leads = 0, purchaseValue = 0
  const currency = cuentas[0]?.currency || 'ARS'
  const rows = cuentas.map(c => {
    const m = extractMetrics(c, period)
    spend += m.spend || 0
    impressions += m.impressions || 0
    clicks += m.clicks || 0
    messages += m.messages || 0
    purchases += m.purchases || 0
    leads += m.leads || 0
    purchaseValue += m.purchase_value || 0
    return { account: c.account_name, m }
  })
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
  const cpc = clicks > 0 ? spend / clicks : 0
  const roas = spend > 0 ? purchaseValue / spend : 0
  const mainResult = purchases || leads || messages
  const mainLabel = purchases ? 'compra' : leads ? 'lead' : messages ? 'msg' : 'resultado'
  const cpr = mainResult > 0 ? spend / mainResult : 0

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reporte ${cliente.nombre} — ${periodLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, system-ui, Helvetica, Arial, sans-serif; color: #1a1a28; padding: 32px; background: white; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #5e72e4; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #5e72e4, #8965e0); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 16px; }
  h1 { font-size: 22px; font-weight: 700; }
  .subtitle { font-size: 12px; color: #6a6a80; margin-top: 2px; }
  .meta { text-align: right; font-size: 11px; color: #6a6a80; }
  h2 { font-size: 14px; font-weight: 700; color: #5e72e4; margin: 24px 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .stat { border: 1px solid #e5e5ee; border-radius: 8px; padding: 12px; }
  .stat .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6a6a80; font-weight: 600; margin-bottom: 4px; }
  .stat .value { font-size: 18px; font-weight: 700; color: #1a1a28; }
  .stat.primary { background: linear-gradient(135deg, #5e72e4, #8965e0); color: white; border: none; }
  .stat.primary .label, .stat.primary .value { color: white; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { background: #f5f5fa; text-align: left; padding: 8px 6px; font-size: 10px; text-transform: uppercase; color: #6a6a80; border-bottom: 1px solid #e5e5ee; }
  td { padding: 8px 6px; border-bottom: 1px solid #f0f0f5; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5ee; text-align: center; font-size: 10px; color: #999; }
  .highlight { color: #5e72e4; font-weight: 700; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: #e8eefe; color: #5e72e4; }
  @media print { body { padding: 16px; } .no-print { display: none; } }
  .print-btn { position: fixed; top: 16px; right: 16px; padding: 10px 18px; background: #5e72e4; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 12px rgba(94,114,228,0.4); }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Descargar PDF</button>
<div class="header">
  <div class="brand">
    <div class="logo">FA</div>
    <div>
      <h1>Reporte de Performance</h1>
      <div class="subtitle">${cliente.nombre} · ${cliente.tipo}</div>
    </div>
  </div>
  <div class="meta">
    <div><strong>${periodLabel}</strong></div>
    <div>Generado el ${hoy}</div>
    ${owner ? `<div>Owner: ${owner.nombre}</div>` : ''}
  </div>
</div>

<h2>Resumen General</h2>
<div class="stats">
  <div class="stat primary"><div class="label">Inversión</div><div class="value">${fmtMoney(spend, currency)}</div></div>
  <div class="stat"><div class="label">Valor Compras</div><div class="value">${fmtMoney(purchaseValue, currency)}</div></div>
  <div class="stat"><div class="label">ROAS</div><div class="value">${fmtDec(roas)}x</div></div>
  <div class="stat"><div class="label">Costo / ${mainLabel}</div><div class="value">${mainResult > 0 ? fmtMoney(cpr, currency) : '—'}</div></div>
</div>

<div class="stats" style="margin-top: 10px;">
  <div class="stat"><div class="label">Impresiones</div><div class="value">${fmtNum(impressions)}</div></div>
  <div class="stat"><div class="label">Clicks</div><div class="value">${fmtNum(clicks)}</div></div>
  <div class="stat"><div class="label">CTR</div><div class="value">${fmtPct(ctr)}</div></div>
  <div class="stat"><div class="label">CPC</div><div class="value">${fmtMoney(cpc, currency)}</div></div>
</div>

<div class="stats" style="margin-top: 10px; grid-template-columns: repeat(3, 1fr);">
  <div class="stat"><div class="label">Mensajes</div><div class="value">${fmtNum(messages)}</div></div>
  <div class="stat"><div class="label">Compras</div><div class="value">${fmtNum(purchases)}</div></div>
  <div class="stat"><div class="label">Leads</div><div class="value">${fmtNum(leads)}</div></div>
</div>

<h2>Detalle por Cuenta Publicitaria</h2>
<table>
  <thead>
    <tr>
      <th>Cuenta</th>
      <th class="num">Gasto</th>
      <th class="num">Impres.</th>
      <th class="num">Clicks</th>
      <th class="num">CTR</th>
      <th class="num">Msgs</th>
      <th class="num">Compras</th>
      <th class="num">ROAS</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map(r => {
      const mRoas = (r.m.spend || 0) > 0 ? (r.m.purchase_value || 0) / (r.m.spend || 1) : 0
      return `<tr>
        <td>${r.account}</td>
        <td class="num">${fmtMoney(r.m.spend || 0, currency)}</td>
        <td class="num">${fmtNum(r.m.impressions || 0)}</td>
        <td class="num">${fmtNum(r.m.clicks || 0)}</td>
        <td class="num">${fmtPct(r.m.ctr || 0)}</td>
        <td class="num">${fmtNum(r.m.messages || 0)}</td>
        <td class="num">${fmtNum(r.m.purchases || 0)}</td>
        <td class="num">${fmtDec(mRoas)}x</td>
      </tr>`
    }).join('')}
  </tbody>
</table>

${cliente.proximo_hito ? `<h2>Próximo Hito</h2><p style="font-size: 12px; line-height: 1.6;">${cliente.proximo_hito}</p>` : ''}
${cliente.objetivo ? `<h2>Objetivo</h2><p style="font-size: 12px; line-height: 1.6;">${cliente.objetivo}</p>` : ''}

<div class="footer">
  Future Agency · Reporte automático generado desde el sistema de gestión<br>
  Datos de Meta Ads · ${periodLabel.toLowerCase()}
</div>

<script>
  setTimeout(() => window.print(), 300);
</script>
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=1100')
  if (!w) throw new Error('Popup bloqueado. Permitir popups para descargar el reporte.')
  w.document.write(html)
  w.document.close()
}
