'use client'
import { useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Cliente, Owner, AdAccount } from '@/lib/supabase'

type Props = { clientes: Cliente[]; owners: Owner[]; adAccounts: AdAccount[]; onUpdate: () => void }

type SortKey = 'account_name' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'messages' | 'purchases' | 'leads'

const STATUS_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Activa', color: '#00d97e', bg: 'rgba(0,217,126,.12)' },
  2: { label: 'Deshabilitada', color: '#f5a623', bg: 'rgba(245,166,35,.12)' },
  3: { label: 'Unsettled', color: '#f5365c', bg: 'rgba(245,54,92,.12)' },
  9: { label: 'Bloqueada', color: '#f5365c', bg: 'rgba(245,54,92,.15)' },
}

function formatMoney(n: number, currency = 'ARS'): string {
  if (currency === 'USD') return `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString('es-AR')
}

export default function TableroAnuncios({ clientes, owners, adAccounts, onUpdate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('spend')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [editingLink, setEditingLink] = useState<number | null>(null)

  const filtered = useMemo(() => {
    let accounts = [...adAccounts]
    if (search) accounts = accounts.filter(a => a.account_name.toLowerCase().includes(search.toLowerCase()))
    if (statusFilter === 'active') accounts = accounts.filter(a => a.account_status === 1 && a.spend > 0)
    if (statusFilter === 'inactive') accounts = accounts.filter(a => a.account_status !== 1 || a.spend === 0)
    accounts.sort((a, b) => {
      const va = a[sortKey] ?? 0
      const vb = b[sortKey] ?? 0
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
    return accounts
  }, [adAccounts, search, statusFilter, sortKey, sortDir])

  const totals = useMemo(() => {
    const ars = adAccounts.filter(a => a.currency === 'ARS')
    return {
      spend: ars.reduce((s, a) => s + Number(a.spend), 0),
      impressions: ars.reduce((s, a) => s + Number(a.impressions), 0),
      clicks: ars.reduce((s, a) => s + Number(a.clicks), 0),
      ctr: ars.reduce((s, a) => s + Number(a.impressions), 0) > 0
        ? (ars.reduce((s, a) => s + Number(a.clicks), 0) / ars.reduce((s, a) => s + Number(a.impressions), 0) * 100)
        : 0,
      messages: adAccounts.reduce((s, a) => s + Number(a.messages), 0),
      purchases: adAccounts.reduce((s, a) => s + Number(a.purchases), 0),
      leads: adAccounts.reduce((s, a) => s + Number(a.leads), 0),
      active: adAccounts.filter(a => a.account_status === 1 && Number(a.spend) > 0).length,
      inactive: adAccounts.filter(a => a.account_status !== 1 || Number(a.spend) === 0).length,
    }
  }, [adAccounts])

  const maxSpend = useMemo(() => Math.max(...adAccounts.map(a => Number(a.spend)), 1), [adAccounts])

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
    { label: 'Gasto (30d)', value: formatMoney(totals.spend), icon: 'fa-money-bill-wave', color: '#00d97e', bg: 'rgba(0,217,126,.1)' },
    { label: 'Impresiones', value: formatNum(totals.impressions), icon: 'fa-eye', color: '#5e72e4', bg: 'rgba(94,114,228,.1)' },
    { label: 'Clicks', value: formatNum(totals.clicks), icon: 'fa-mouse-pointer', color: '#f5a623', bg: 'rgba(245,166,35,.1)' },
    { label: 'CTR Promedio', value: `${totals.ctr.toFixed(2)}%`, icon: 'fa-percentage', color: '#a78bfa', bg: 'rgba(167,139,250,.1)' },
    { label: 'Cuentas Activas', value: String(totals.active), icon: 'fa-signal', color: '#00d97e', bg: 'rgba(0,217,126,.1)' },
    { label: 'Mensajes', value: formatNum(totals.messages), icon: 'fa-comments', color: '#5e72e4', bg: 'rgba(94,114,228,.1)' },
    { label: 'Compras', value: formatNum(totals.purchases), icon: 'fa-shopping-cart', color: '#f5a623', bg: 'rgba(245,166,35,.1)' },
    { label: 'Leads', value: formatNum(totals.leads), icon: 'fa-user-plus', color: '#fb7185', bg: 'rgba(251,113,133,.1)' },
  ]

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <i className="fas fa-sort" style={{ fontSize: 9, color: '#4a4a60', marginLeft: 4 }} />
    return <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`} style={{ fontSize: 9, color: '#5e72e4', marginLeft: 4 }} />
  }

  return (
    <div className="fade-in">
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
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
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4a4a60' }}>
          <i className="fas fa-clock" style={{ marginRight: 4 }} />
          Datos últimos 30 días
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('account_name')}>Cuenta {sortIcon('account_name')}</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('spend')}>Gasto {sortIcon('spend')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('impressions')}>Impr. {sortIcon('impressions')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('clicks')}>Clicks {sortIcon('clicks')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('ctr')}>CTR {sortIcon('ctr')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('messages')}>Msgs {sortIcon('messages')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('purchases')}>Compras {sortIcon('purchases')}</th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => toggleSort('leads')}>Leads {sortIcon('leads')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((acc, i) => {
                const cliente = clientes.find(c => c.id === acc.cliente_id)
                const owner = cliente ? owners.find(o => o.id === cliente.owner_id) : null
                const status = STATUS_LABELS[acc.account_status] || STATUS_LABELS[1]
                const spend = Number(acc.spend)
                const spendPct = maxSpend > 0 ? (spend / maxSpend) * 100 : 0
                const ctrVal = Number(acc.ctr)
                const ctrColor = ctrVal >= 3 ? '#00d97e' : ctrVal >= 1.5 ? '#f5a623' : ctrVal > 0 ? '#f5365c' : '#4a4a60'

                return (
                  <tr key={acc.id} style={{ opacity: spend === 0 ? 0.5 : 1 }}>
                    <td style={{ color: '#4a4a60', fontSize: 11 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #1877F2, #0866FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="fab fa-meta" style={{ fontSize: 13, color: '#fff' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{acc.account_name}</div>
                          <div style={{ fontSize: 9, color: '#4a4a60' }}>{acc.account_id}</div>
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
                    <td>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: status.bg, color: status.color, fontWeight: 600 }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: spend > 0 ? '#e8e8f0' : '#4a4a60' }}>
                          {spend > 0 ? formatMoney(spend, acc.currency) : '—'}
                        </span>
                        {spend > 0 && (
                          <div style={{ width: 60, height: 4, borderRadius: 2, background: '#1a1a28', overflow: 'hidden' }}>
                            <div style={{ width: `${spendPct}%`, height: '100%', borderRadius: 2, background: spendPct > 60 ? '#f5365c' : spendPct > 30 ? '#f5a623' : '#00d97e' }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: '#a0a0b8' }}>{Number(acc.impressions) > 0 ? formatNum(Number(acc.impressions)) : '—'}</td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: '#a0a0b8' }}>{Number(acc.clicks) > 0 ? formatNum(Number(acc.clicks)) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {ctrVal > 0 ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: ctrColor }}>{ctrVal.toFixed(2)}%</span>
                      ) : <span style={{ color: '#4a4a60' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: Number(acc.messages) > 0 ? '#5e72e4' : '#4a4a60' }}>
                      {Number(acc.messages) > 0 ? formatNum(Number(acc.messages)) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: Number(acc.purchases) > 0 ? '#00d97e' : '#4a4a60' }}>
                      {Number(acc.purchases) > 0 ? formatNum(Number(acc.purchases)) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: Number(acc.leads) > 0 ? '#fb7185' : '#4a4a60' }}>
                      {Number(acc.leads) > 0 ? formatNum(Number(acc.leads)) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts section */}
      {(adAccounts.some(a => a.account_status !== 1) || adAccounts.some(a => Number(a.spend) === 0 && a.account_status === 1)) && (
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
          {adAccounts.filter(a => Number(a.spend) === 0 && a.account_status === 1).length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid #f5a623' }}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f5a623', marginBottom: 8 }}>
                  <i className="fas fa-pause-circle" style={{ marginRight: 6 }} />
                  Sin gasto (activas pero $0) ({adAccounts.filter(a => Number(a.spend) === 0 && a.account_status === 1).length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {adAccounts.filter(a => Number(a.spend) === 0 && a.account_status === 1).map(a => (
                    <span key={a.id} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(245,166,35,.1)', color: '#f5a623', fontWeight: 600 }}>
                      {a.account_name}
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
