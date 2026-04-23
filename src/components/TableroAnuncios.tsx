'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Owner, AdAccount, PeriodMetrics } from '@/lib/supabase'
import GestionAnuncio from './GestionAnuncio'
import GestionCuentasModal from './GestionCuentasModal'
import type { Agencia } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[]; adAccounts: AdAccount[]; onUpdate: () => void; agencias?: Agencia[]; agenciaId?: string }

type Period = '7d' | '15d' | '30d'
type SortKey = 'account_name' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpr' | 'roas' | 'messages' | 'purchases' | 'leads' | 'purchase_value'

const STATUS_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Activa', color: '#00d97e', bg: 'rgba(0,217,126,.12)' },
  2: { label: 'Deshabilitada', color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
  3: { label: 'Unsettled', color: '#f5365c', bg: 'rgba(245,54,92,.12)' },
  9: { label: 'Bloqueada', color: '#f5365c', bg: 'rgba(245,54,92,.15)' },
}

function formatMoney(n: number, currency = 'ARS'): string {
  if (currency === 'USD') return `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString('es-AR')
}

type Row = {
  acc: AdAccount
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  purchases: number
  leads: number
  messages: number
  purchase_value: number
  mainResult: number
  mainResultLabel: string
  cpr: number // cost per result
  roas: number
}

function extractMetrics(acc: AdAccount, period: Period): PeriodMetrics {
  const key = period === '7d' ? 'metrics_7d' : period === '15d' ? 'metrics_15d' : 'metrics_30d'
  const m = acc[key]
  if (m && Object.keys(m).length > 0) return m
  // fallback to flat fields (30d)
  return {
    spend: Number(acc.spend) || 0,
    impressions: Number(acc.impressions) || 0,
    clicks: Number(acc.clicks) || 0,
    ctr: Number(acc.ctr) || 0,
    cpc: Number(acc.cpc) || 0,
    purchases: Number(acc.purchases) || 0,
    leads: Number(acc.leads) || 0,
    messages: Number(acc.messages) || 0,
    purchase_value: 0,
  }
}

function buildRow(acc: AdAccount, period: Period): Row {
  const m = extractMetrics(acc, period)
  const spend = Number(m.spend) || 0
  const purchases = Number(m.purchases) || 0
  const leads = Number(m.leads) || 0
  const messages = Number(m.messages) || 0
  const purchase_value = Number(m.purchase_value) || 0
  // Main result priority: purchases > leads > messages
  let mainResult = 0
  let mainResultLabel = '—'
  if (purchases > 0) { mainResult = purchases; mainResultLabel = 'compra' }
  else if (leads > 0) { mainResult = leads; mainResultLabel = 'lead' }
  else if (messages > 0) { mainResult = messages; mainResultLabel = 'msg' }
  const cpr = mainResult > 0 ? spend / mainResult : 0
  const roas = spend > 0 && purchase_value > 0 ? purchase_value / spend : 0
  return {
    acc,
    spend,
    impressions: Number(m.impressions) || 0,
    clicks: Number(m.clicks) || 0,
    ctr: Number(m.ctr) || 0,
    cpc: Number(m.cpc) || 0,
    purchases,
    leads,
    messages,
    purchase_value,
    mainResult,
    mainResultLabel,
    cpr,
    roas,
  }
}

export default function TableroAnuncios({ clientes, owners, adAccounts, onUpdate, agencias = [], agenciaId = 'future' }: Props) {
  const [period, setPeriod] = useState<Period>('30d')
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [editingLink, setEditingLink] = useState<number | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AdAccount | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')
  const [showManageModal, setShowManageModal] = useState(false)

  async function syncMetaAds() {
    setSyncing(true); setSyncStatus('')
    try {
      const res = await fetch('https://nnwndlyiwjbybcjljdtu.supabase.co/functions/v1/sync-meta-ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
      })
      const json = await res.json()
      if (json.ok) {
        setSyncStatus(`${json.synced}/${json.total} cuentas actualizadas`)
        onUpdate()
      } else setSyncStatus('Error: ' + (json.error || 'desconocido'))
    } catch (e: any) {
      setSyncStatus('Error: ' + e.message)
    }
    setSyncing(false)
    setTimeout(() => setSyncStatus(''), 5000)
  }

  const lastSync = useMemo(() => {
    const times = adAccounts.map(a => a.last_synced_at).filter(Boolean) as string[]
    if (times.length === 0) return null
    return times.sort().reverse()[0]
  }, [adAccounts])

  const periodLabel = period === '7d' ? 'últimos 7 días' : period === '15d' ? 'últimos 15 días' : 'últimos 30 días'

  const rows: Row[] = useMemo(() => adAccounts.map(a => buildRow(a, period)), [adAccounts, period])

  const filtered = useMemo(() => {
    let rs = [...rows]
    if (search) rs = rs.filter(r => r.acc.account_name.toLowerCase().includes(search.toLowerCase()))
    if (statusFilter === 'active') rs = rs.filter(r => r.acc.account_status === 1 && r.spend > 0)
    if (statusFilter === 'inactive') rs = rs.filter(r => r.acc.account_status !== 1 || r.spend === 0)
    if (ownerFilter !== 'all') {
      rs = rs.filter(r => {
        const cliente = clientes.find(c => c.id === r.acc.cliente_id)
        if (!cliente) return ownerFilter === 'none'
        return cliente.owner_id === ownerFilter
      })
    }
    rs.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      if (sortKey === 'account_name') { va = a.acc.account_name; vb = b.acc.account_name }
      else { va = a[sortKey] as number; vb = b[sortKey] as number }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
    return rs
  }, [rows, search, statusFilter, ownerFilter, clientes, sortKey, sortDir])

  const totals = useMemo(() => {
    const ars = rows.filter(r => r.acc.currency === 'ARS')
    const totalImpr = ars.reduce((s, r) => s + r.impressions, 0)
    const totalClicks = ars.reduce((s, r) => s + r.clicks, 0)
    const totalSpend = ars.reduce((s, r) => s + r.spend, 0)
    const totalPV = ars.reduce((s, r) => s + r.purchase_value, 0)
    return {
      spend: totalSpend,
      impressions: totalImpr,
      clicks: totalClicks,
      ctr: totalImpr > 0 ? (totalClicks / totalImpr * 100) : 0,
      messages: rows.reduce((s, r) => s + r.messages, 0),
      purchases: rows.reduce((s, r) => s + r.purchases, 0),
      leads: rows.reduce((s, r) => s + r.leads, 0),
      purchase_value: totalPV,
      roas: totalSpend > 0 ? totalPV / totalSpend : 0,
      active: rows.filter(r => r.acc.account_status === 1 && r.spend > 0).length,
      inactive: rows.filter(r => r.acc.account_status !== 1 || r.spend === 0).length,
    }
  }, [rows])

  const maxSpend = useMemo(() => Math.max(...rows.map(r => r.spend), 1), [rows])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  async function linkCliente(adAccountId: number, clienteId: number | null) {
    await supabase.from('ad_accounts').update({ cliente_id: clienteId }).eq('id', adAccountId)
    setEditingLink(null)
    onUpdate()
  }

  const stats = [
    { label: `Gasto (${period})`, value: formatMoney(totals.spend), icon: 'fa-money-bill-wave', color: '#00d97e', bg: 'rgba(0,217,126,.1)' },
    { label: 'Valor Compras', value: formatMoney(totals.purchase_value), icon: 'fa-sack-dollar', color: '#00d97e', bg: 'rgba(0,217,126,.1)' },
    { label: 'ROAS', value: totals.roas > 0 ? `${totals.roas.toFixed(2)}x` : '—', icon: 'fa-chart-line', color: '#a78bfa', bg: 'rgba(167,139,250,.1)' },
    { label: 'CTR Promedio', value: `${totals.ctr.toFixed(2)}%`, icon: 'fa-percentage', color: '#5e72e4', bg: 'rgba(94,114,228,.1)' },
    { label: 'Impresiones', value: formatNum(totals.impressions), icon: 'fa-eye', color: '#5e72e4', bg: 'rgba(94,114,228,.1)' },
    { label: 'Mensajes', value: formatNum(totals.messages), icon: 'fa-comments', color: '#5e72e4', bg: 'rgba(94,114,228,.1)' },
    { label: 'Compras', value: formatNum(totals.purchases), icon: 'fa-shopping-cart', color: '#f5a623', bg: 'rgba(245,166,35,.1)' },
    { label: 'Leads', value: formatNum(totals.leads), icon: 'fa-user-plus', color: '#fb7185', bg: 'rgba(251,113,133,.1)' },
  ]

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <i className="fas fa-sort" style={{ fontSize: 9, color: '#4a4a60', marginLeft: 4 }} />
    return <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ fontSize: 9, color: '#5e72e4', marginLeft: 4 }} />
  }

  const ownersWithCount = useMemo(() => {
    return owners.map(o => {
      const count = rows.filter(r => {
        const c = clientes.find(cl => cl.id === r.acc.cliente_id)
        return c && c.owner_id === o.id
      }).length
      return { ...o, count }
    })
  }, [owners, rows, clientes])

  if (selectedAccount) {
    const clienteVinculado = clientes.find(c => c.id === selectedAccount.cliente_id) || null
    return <GestionAnuncio account={selectedAccount} cliente={clienteVinculado} onBack={() => { setSelectedAccount(null); onUpdate() }} />
  }

  return (
    <div className="fade-in">
      {showManageModal && (
        <GestionCuentasModal
          agenciaId={agenciaId}
          agencias={agencias}
          clientes={clientes}
          onClose={() => setShowManageModal(false)}
          onUpdate={onUpdate}
        />
      )}
      {/* Period toggle + export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#1a1a28', padding: 4, borderRadius: 10 }}>
          {(['7d', '15d', '30d'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '8px 18px',
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                background: period === p ? 'linear-gradient(135deg, #5e72e4, #825ee4)' : 'transparent',
                color: period === p ? '#fff' : '#8a8aa0',
                transition: 'all .15s',
              }}
            >
              {p === '7d' ? '7 días' : p === '15d' ? '15 días' : '30 días'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: '#6a6a80', fontWeight: 600 }}>
          <i className="fas fa-calendar" style={{ marginRight: 6 }} />
          Reporte {periodLabel}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {syncStatus && <span style={{ fontSize: 11, color: syncStatus.startsWith('Error') ? '#f5365c' : '#00d97e', fontWeight: 600 }}>{syncStatus}</span>}
          {lastSync && !syncStatus && (
            <span style={{ fontSize: 10, color: '#4a4a60' }}>
              <i className="fas fa-clock" style={{ marginRight: 3 }} />
              Ultima sync: {new Date(lastSync).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setShowManageModal(true)} style={{ fontSize: 11 }}>
            <i className="fas fa-cog" /> Gestionar cuentas
          </button>
          <button className="btn btn-sm" onClick={syncMetaAds} disabled={syncing}
            style={{ background: syncing ? '#2a2a40' : 'linear-gradient(135deg, #5e72e4, #8965e0)', color: 'white', fontSize: 11 }}>
            <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} /> {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          <span style={{ fontSize: 11, color: '#4a4a60' }}>
            <i className="fas fa-database" style={{ marginRight: 4 }} />
            {adAccounts.length} cuentas · Meta Ads
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: 0 }}>
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${s.icon}`} style={{ fontSize: 18, color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#e8e8f0', lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 260 }}>
          <i className="fas fa-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#4a4a60' }} />
          <input
            type="text" placeholder="Buscar cuenta..." value={search} onChange={e => setSearch(e.target.value)}
            className="input" style={{ width: '100%', paddingLeft: 32, fontSize: 12 }}
          />
        </div>
        {(['all', 'active', 'inactive'] as const).map(f => (
          <span key={f} className={`owner-chip ${statusFilter === f ? 'active' : ''}`}
            onClick={() => setStatusFilter(f)}
            style={statusFilter === f ? { borderColor: '#5e72e4', color: '#5e72e4', background: 'rgba(94,114,228,.12)' } : {}}>
            {f === 'all' ? `Todas (${adAccounts.length})` : f === 'active' ? `Con gasto (${totals.active})` : `Sin gasto (${totals.inactive})`}
          </span>
        ))}
      </div>

      {/* Owner filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>Owner:</span>
        <span className={`owner-chip ${ownerFilter === 'all' ? 'active' : ''}`}
          onClick={() => setOwnerFilter('all')}
          style={ownerFilter === 'all' ? { borderColor: '#5e72e4', color: '#5e72e4', background: 'rgba(94,114,228,.12)' } : {}}>
          Todos
        </span>
        {ownersWithCount.filter(o => o.activo).map(o => (
          <span key={o.id}
            className={`owner-chip ${ownerFilter === o.id ? 'active' : ''}`}
            onClick={() => setOwnerFilter(o.id)}
            style={ownerFilter === o.id
              ? { borderColor: o.color, color: o.color, background: o.color + '18' }
              : {}}>
            {o.nombre_corto} ({o.count})
          </span>
        ))}
        <span className={`owner-chip ${ownerFilter === 'none' ? 'active' : ''}`}
          onClick={() => setOwnerFilter('none')}
          style={ownerFilter === 'none' ? { borderColor: '#6a6a80', color: '#6a6a80', background: 'rgba(106,106,128,.12)' } : {}}>
          Sin vincular
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('account_name')}>Cuenta {sortIcon('account_name')}</th>
                <th>Cliente</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('spend')}>Gasto {sortIcon('spend')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('impressions')}>Impr. {sortIcon('impressions')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('clicks')}>Clicks {sortIcon('clicks')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('ctr')}>CTR {sortIcon('ctr')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('messages')}>Msgs {sortIcon('messages')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('purchases')}>Compras {sortIcon('purchases')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('leads')}>Leads {sortIcon('leads')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('cpr')}>Costo/Res. {sortIcon('cpr')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('roas')}>ROAS {sortIcon('roas')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('purchase_value')}>Valor Compras {sortIcon('purchase_value')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const acc = r.acc
                const cliente = clientes.find(c => c.id === acc.cliente_id)
                const owner = cliente ? owners.find(o => o.id === cliente.owner_id) : null
                const spendPct = maxSpend > 0 ? (r.spend / maxSpend) * 100 : 0
                const ctrColor = r.ctr >= 3 ? '#00d97e' : r.ctr >= 1.5 ? '#f5a623' : r.ctr > 0 ? '#f5365c' : '#4a4a60'
                const roasColor = r.roas >= 3 ? '#00d97e' : r.roas >= 1.5 ? '#f5a623' : r.roas > 0 ? '#f5365c' : '#4a4a60'

                return (
                  <tr key={acc.id} style={{ opacity: r.spend === 0 ? 0.5 : 1 }}>
                    <td style={{ color: '#4a4a60', fontSize: 11 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setSelectedAccount(acc)}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: acc.platform === 'manual' ? 'linear-gradient(135deg, #f5a623, #fc6e51)' : 'linear-gradient(135deg, #1877F2, #0866FF)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <i className={acc.platform === 'manual' ? 'fas fa-user-edit' : 'fab fa-meta'} style={{ fontSize: 13, color: '#fff' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#5e72e4', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {acc.account_name}
                            {acc.platform === 'manual' && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(245,166,35,.2)', color: '#f5a623', fontWeight: 700 }}>MANUAL</span>}
                          </div>
                          <div style={{ fontSize: 9, color: '#4a4a60' }}>{acc.platform === 'manual' ? 'Sin cuenta Meta' : acc.account_id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {editingLink === acc.id ? (
                        <select
                          className="editable-select"
                          style={{ fontSize: 11, minWidth: 120 }}
                          value={acc.cliente_id || ''}
                          onChange={e => linkCliente(acc.id, e.target.value ? parseInt(e.target.value) : null)}
                          onBlur={() => setEditingLink(null)}
                          autoFocus
                        >
                          <option value="">Sin vincular</option>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      ) : (
                        <div onClick={() => setEditingLink(acc.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cliente ? (
                            <>
                              <span style={{ fontWeight: 500, fontSize: 12 }}>{cliente.nombre}</span>
                              {owner && <span style={{ fontSize: 9, color: owner.color, padding: '1px 5px', borderRadius: 3, background: owner.color + '18' }}>{owner.nombre_corto}</span>}
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: '#4a4a60', fontStyle: 'italic' }}>+ vincular</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: r.spend > 0 ? '#e8e8f0' : '#4a4a60' }}>
                          {r.spend > 0 ? formatMoney(r.spend, acc.currency) : '—'}
                        </span>
                        {r.spend > 0 && (
                          <div style={{ width: 60, height: 4, borderRadius: 2, background: '#1a1a28', overflow: 'hidden' }}>
                            <div style={{ width: `${spendPct}%`, height: '100%', borderRadius: 2, background: spendPct > 60 ? '#f5365c' : spendPct > 30 ? '#f5a623' : '#00d97e' }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: '#a0a0b8' }}>{r.impressions > 0 ? formatNum(r.impressions) : '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: '#a0a0b8' }}>{r.clicks > 0 ? formatNum(r.clicks) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {r.ctr > 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: ctrColor }}>{r.ctr.toFixed(2)}%</span>
                      ) : <span style={{ color: '#4a4a60' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: r.messages > 0 ? '#5e72e4' : '#4a4a60' }}>
                      {r.messages > 0 ? formatNum(r.messages) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: r.purchases > 0 ? '#00d97e' : '#4a4a60', fontWeight: r.purchases > 0 ? 700 : 400 }}>
                      {r.purchases > 0 ? formatNum(r.purchases) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: r.leads > 0 ? '#fb7185' : '#4a4a60' }}>
                      {r.leads > 0 ? formatNum(r.leads) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.cpr > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#e8e8f0' }}>{formatMoney(r.cpr, acc.currency)}</span>
                          <span style={{ fontSize: 9, color: '#6a6a80' }}>/ {r.mainResultLabel}</span>
                        </div>
                      ) : <span style={{ color: '#4a4a60' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.roas > 0 ? (
                        <span style={{ fontSize: 13, fontWeight: 700, color: roasColor }}>{r.roas.toFixed(2)}x</span>
                      ) : <span style={{ color: '#4a4a60' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: r.purchase_value > 0 ? '#00d97e' : '#4a4a60' }}>
                      {r.purchase_value > 0 ? formatMoney(r.purchase_value, acc.currency) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts section */}
      {(adAccounts.some(a => a.account_status !== 1) || rows.some(r => r.spend === 0 && r.acc.account_status === 1)) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          {adAccounts.filter(a => a.account_status !== 1).length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid #f5365c' }}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f5365c', marginBottom: 8 }}>
                  <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                  Cuentas con problemas ({adAccounts.filter(a => a.account_status !== 1).length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {adAccounts.filter(a => a.account_status !== 1).map(a => {
                    const st = STATUS_LABELS[a.account_status] || STATUS_LABELS[1]
                    return (
                      <span key={a.id} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: st.bg, color: st.color, fontWeight: 600 }}>
                        {a.account_name} — {st.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {rows.filter(r => r.spend === 0 && r.acc.account_status === 1).length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid #f5a623' }}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f5a623', marginBottom: 8 }}>
                  <i className="fas fa-pause-circle" style={{ marginRight: 6 }} />
                  Sin gasto en {period} ({rows.filter(r => r.spend === 0 && r.acc.account_status === 1).length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {rows.filter(r => r.spend === 0 && r.acc.account_status === 1).map(r => (
                    <span key={r.acc.id} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(245,166,35,.1)', color: '#f5a623', fontWeight: 600 }}>
                      {r.acc.account_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
