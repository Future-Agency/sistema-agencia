'use client'
import { useState, useEffect } from 'react'
import { supabase, type AdAccount, type Cliente, type Agencia } from '@/lib/supabase'

type Props = {
  agenciaId: string
  agencias: Agencia[]
  clientes: Cliente[]
  onClose: () => void
  onUpdate: () => void
}

export default function GestionCuentasModal({ agenciaId, agencias, clientes, onClose, onUpdate }: Props) {
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [discoverResult, setDiscoverResult] = useState<string>('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('ad_accounts').select('*').order('spend', { ascending: false })
    if (data) setAccounts(data)
    setLoading(false)
  }

  async function toggleActive(acc: AdAccount) {
    await supabase.from('ad_accounts').update({ activo: !acc.activo }).eq('id', acc.id)
    load(); onUpdate()
  }

  async function changeAgencia(acc: AdAccount, newAgencia: string) {
    await supabase.from('ad_accounts').update({ agencia_id: newAgencia }).eq('id', acc.id)
    load(); onUpdate()
  }

  async function changeCliente(acc: AdAccount, clienteId: number | null) {
    await supabase.from('ad_accounts').update({ cliente_id: clienteId }).eq('id', acc.id)
    load(); onUpdate()
  }

  async function discoverNew() {
    setDiscovering(true); setDiscoverResult('')
    try {
      const res = await fetch('https://nnwndlyiwjbybcjljdtu.supabase.co/functions/v1/discover-meta-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ agencia_id: agenciaId }),
      })
      const json = await res.json()
      if (json.ok) {
        if (json.new_accounts > 0) {
          setDiscoverResult(`${json.new_accounts} cuentas nuevas agregadas: ${json.inserted_names.slice(0, 3).join(', ')}${json.inserted_names.length > 3 ? '...' : ''}`)
          load(); onUpdate()
        } else {
          setDiscoverResult(`Todas las ${json.existing} cuentas ya estaban sincronizadas`)
        }
      } else setDiscoverResult('Error: ' + json.error)
    } catch (e: any) {
      setDiscoverResult('Error: ' + e.message)
    }
    setDiscovering(false)
    setTimeout(() => setDiscoverResult(''), 8000)
  }

  async function deleteAccount(acc: AdAccount) {
    if (!confirm(`Eliminar DEFINITIVAMENTE "${acc.account_name}"?\n\nEsto borra toda la configuracion, creativos, campañas y logs asociados.\nSi volves a sincronizar, la cuenta se va a traer de Meta de nuevo (sin tus datos).`)) return
    await supabase.from('ad_accounts').delete().eq('id', acc.id)
    load(); onUpdate()
  }

  const filtered = accounts.filter(a => {
    if (!showInactive && !a.activo) return false
    if (search && !a.account_name.toLowerCase().includes(search.toLowerCase()) && !a.account_id.includes(search)) return false
    return true
  })

  const stats = {
    total: accounts.length,
    activas: accounts.filter(a => a.activo).length,
    ocultas: accounts.filter(a => !a.activo).length,
    sinAgencia: accounts.filter(a => !a.agencia_id || a.agencia_id === 'future').filter(a => a.activo).length,
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Gestionar Cuentas Publicitarias</div>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>
              {stats.activas} activas · {stats.ocultas} ocultas · {stats.total} total
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><i className="fas fa-times" /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="Buscar por nombre o ID..."
              style={{ flex: 1, minWidth: 200 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowInactive(!showInactive)}
              style={{ background: showInactive ? 'rgba(245,166,35,.12)' : 'transparent', borderColor: showInactive ? '#f5a623' : undefined, color: showInactive ? '#f5a623' : undefined }}
            >
              <i className={`fas ${showInactive ? 'fa-eye' : 'fa-eye-slash'}`} /> {showInactive ? 'Ocultando ocultas' : 'Ver ocultas'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={discoverNew}
              disabled={discovering}
              style={{ background: 'linear-gradient(135deg, #5e72e4, #8965e0)' }}
            >
              <i className={`fas ${discovering ? 'fa-spinner fa-spin' : 'fa-plus-circle'}`} /> {discovering ? 'Buscando...' : 'Traer cuentas nuevas'}
            </button>
          </div>

          {discoverResult && (
            <div style={{ padding: 10, borderRadius: 8, background: discoverResult.startsWith('Error') ? 'rgba(245,54,92,.08)' : 'rgba(0,217,126,.08)', border: `1px solid ${discoverResult.startsWith('Error') ? '#f5365c33' : '#00d97e33'}`, marginBottom: 12, fontSize: 12, color: discoverResult.startsWith('Error') ? '#f5365c' : '#00d97e' }}>
              <i className="fas fa-info-circle" style={{ marginRight: 6 }} />{discoverResult}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6a6a80' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
            </div>
          ) : (
            <table className="table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Cuenta</th>
                  <th>Agencia</th>
                  <th>Cliente Vinculado</th>
                  <th style={{ textAlign: 'right' }}>Gasto 30d</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Estado</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(acc => {
                  const agencia = agencias.find(a => a.id === acc.agencia_id)
                  return (
                    <tr key={acc.id} style={{ opacity: acc.activo ? 1 : 0.5 }}>
                      <td>
                        <div style={{ width: 24, height: 24, borderRadius: 5, background: 'linear-gradient(135deg, #1877F2, #0866FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fab fa-meta" style={{ color: '#fff', fontSize: 10 }} />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{acc.account_name}</div>
                        <div style={{ fontSize: 9, color: '#6a6a80' }}>{acc.account_id} · {acc.currency}</div>
                      </td>
                      <td>
                        <select
                          className="editable-select"
                          value={acc.agencia_id || 'future'}
                          onChange={e => changeAgencia(acc, e.target.value)}
                          style={{ fontSize: 10, width: '100%' }}
                        >
                          {agencias.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="editable-select"
                          value={acc.cliente_id || ''}
                          onChange={e => changeCliente(acc, e.target.value ? parseInt(e.target.value) : null)}
                          style={{ fontSize: 10, width: '100%' }}
                        >
                          <option value="">Sin vincular</option>
                          {clientes.filter(c => c.agencia_id === acc.agencia_id).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                        {acc.spend > 0 ? `$${(acc.spend / 1000).toFixed(0)}K` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleActive(acc)}
                          style={{ color: acc.activo ? '#00d97e' : '#f5a623', fontSize: 10, padding: '3px 8px' }}
                          title={acc.activo ? 'Ocultar del tablero' : 'Mostrar en tablero'}
                        >
                          <i className={`fas ${acc.activo ? 'fa-eye' : 'fa-eye-slash'}`} /> {acc.activo ? 'Visible' : 'Oculta'}
                        </button>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteAccount(acc)} style={{ color: '#f5365c', fontSize: 11 }} title="Eliminar definitivamente">
                          <i className="fas fa-trash" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6a6a80', padding: 24 }}>
                    {accounts.length === 0 ? 'Sin cuentas sincronizadas' : 'No hay coincidencias'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer" style={{ background: '#0a0a14', borderTop: '1px solid #1a1a28', padding: 12 }}>
          <div style={{ fontSize: 10, color: '#6a6a80', flex: 1 }}>
            <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
            Ocultar no borra — la cuenta sigue sincronizando, solo no se muestra. Eliminar es permanente.
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
