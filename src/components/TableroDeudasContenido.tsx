'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type DeudaContenido, type DeudaContenidoEstado } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'
import { cicloMesLabel } from '@/lib/cycles'

type Props = {
  agenciaId: string
  currentUser: CurrentUser
  clientes: Cliente[]
}

export default function TableroDeudasContenido({ agenciaId, currentUser, clientes }: Props) {
  const [items, setItems] = useState<DeudaContenido[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<DeudaContenido> | null>(null)
  const [filtro, setFiltro] = useState<DeudaContenidoEstado | 'todos'>('pendiente')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deudas_contenido')
      .select('*')
      .eq('agencia_id', agenciaId)
      .order('created_at', { ascending: false })
    if (error) { console.warn('[deudas]', error); setItems([]) }
    else setItems((data ?? []) as DeudaContenido[])
    setLoading(false)
  }, [agenciaId])

  useEffect(() => { load() }, [load])

  const clienteById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return items
    return items.filter(d => d.estado === filtro)
  }, [items, filtro])

  // Agrupado por cliente (sumando deudas pendientes)
  const porCliente = useMemo(() => {
    const m = new Map<number, { cliente: Cliente; total: number; deudas: DeudaContenido[] }>()
    for (const d of items) {
      if (d.estado !== 'pendiente') continue
      const c = clienteById.get(d.cliente_id)
      if (!c) continue
      if (!m.has(c.id)) m.set(c.id, { cliente: c, total: 0, deudas: [] })
      const bucket = m.get(c.id)!
      bucket.total += d.cantidad
      bucket.deudas.push(d)
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total)
  }, [items, clienteById])

  const totalDebemos = useMemo(() => {
    return items.filter(d => d.estado === 'pendiente').reduce((s, d) => s + d.cantidad, 0)
  }, [items])

  const saldar = async (d: DeudaContenido) => {
    if (!window.confirm(`Marcar deuda de ${clienteById.get(d.cliente_id)?.nombre} (${d.cantidad > 0 ? '+' : ''}${d.cantidad} contenidos) como saldada?`)) return
    await supabase.from('deudas_contenido').update({
      estado: 'saldada',
      resolved_at: new Date().toISOString(),
      resolved_by: currentUser.name,
      updated_at: new Date().toISOString(),
    }).eq('id', d.id)
    load()
  }
  const cancelar = async (d: DeudaContenido) => {
    if (!window.confirm(`Cancelar esta deuda?`)) return
    await supabase.from('deudas_contenido').update({
      estado: 'cancelada',
      resolved_at: new Date().toISOString(),
      resolved_by: currentUser.name,
      updated_at: new Date().toISOString(),
    }).eq('id', d.id)
    load()
  }
  const eliminar = async (d: DeudaContenido) => {
    if (!window.confirm(`Eliminar deuda permanentemente?`)) return
    await supabase.from('deudas_contenido').delete().eq('id', d.id)
    load()
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📒 Deudas de Contenido</h2>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0, marginTop: 2 }}>
            Lo que le debemos al cliente (o nos debe). Se generan auto al cerrar Subida si faltó contenido vs lo pactado.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: '10px 14px', background: totalDebemos > 0 ? 'rgba(245,54,92,.15)' : 'rgba(0,217,126,.10)',
            border: `1px solid ${totalDebemos > 0 ? '#f5365c' : '#00d97e'}`,
            borderRadius: 10, fontSize: 13, fontWeight: 700,
            color: totalDebemos > 0 ? '#f5365c' : '#00d97e',
          }}>
            {totalDebemos > 0 ? `Debemos: ${totalDebemos}` : totalDebemos < 0 ? `A favor: ${Math.abs(totalDebemos)}` : 'Sin deuda'}
          </div>
          <button onClick={() => setEditing({ cantidad: 1, estado: 'pendiente', origen: 'manual' })}
            style={btnPrimary}>
            <i className="fas fa-plus" style={{ marginRight: 6 }} />Sumar deuda
          </button>
        </div>
      </div>

      {/* Resumen por cliente con deuda pendiente */}
      {porCliente.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 8 }}>
            Por cliente — pendientes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {porCliente.map(({ cliente, total, deudas }) => (
              <div key={cliente.id} style={{
                padding: '10px 12px', borderRadius: 8,
                background: '#1a1a28',
                border: `1px solid ${total > 0 ? 'rgba(245,54,92,.30)' : 'rgba(0,217,126,.30)'}`,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{cliente.nombre}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: total > 0 ? '#f5365c' : '#00d97e', marginTop: 4 }}>
                  {total > 0 ? `${total} contenidos` : `+${Math.abs(total)} a favor`}
                </div>
                <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2 }}>
                  {deudas.length} {deudas.length === 1 ? 'movimiento' : 'movimientos'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['pendiente', 'saldada', 'cancelada', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{
              padding: '6px 12px', borderRadius: 6,
              background: filtro === f ? '#5e72e4' : '#1a1a28',
              border: `1px solid ${filtro === f ? '#5e72e4' : '#2a2a40'}`,
              color: filtro === f ? '#fff' : '#a0a0b8',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              textTransform: 'capitalize' as const,
            }}>{f}</button>
        ))}
      </div>

      {/* Listado */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80' }}>Cargando…</div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 13 }}>Sin deudas en este filtro.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
          {filtradas.map(d => {
            const c = clienteById.get(d.cliente_id)
            const isDebt = d.cantidad > 0
            return (
              <div key={d.id} style={{
                padding: '10px 14px', borderRadius: 8,
                background: '#1a1a28', border: '1px solid #2a2a40',
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const,
                opacity: d.estado !== 'pendiente' ? 0.55 : 1,
              }}>
                <div style={{
                  minWidth: 70, fontSize: 18, fontWeight: 800,
                  color: isDebt ? '#f5365c' : '#00d97e',
                }}>
                  {isDebt ? '+' : ''}{d.cantidad}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{c?.nombre ?? `Cliente #${d.cliente_id}`}</div>
                  <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>
                    Ciclo origen: <strong style={{ color: '#a0a0b8', textTransform: 'capitalize' as const }}>{cicloMesLabel(d.ciclo_origen)}</strong>
                    {' · '}origen: <span style={{ color: d.origen === 'auto_subida' ? '#5e72e4' : '#a0a0b8' }}>{d.origen === 'auto_subida' ? 'auto (subida)' : 'manual'}</span>
                  </div>
                  {d.motivo && <div style={{ fontSize: 12, color: '#e8e8f0', marginTop: 4 }}>{d.motivo}</div>}
                </div>
                <span style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 4, fontWeight: 700,
                  background: d.estado === 'pendiente' ? 'rgba(245,166,35,.15)' : d.estado === 'saldada' ? 'rgba(0,217,126,.15)' : 'rgba(106,106,128,.15)',
                  color: d.estado === 'pendiente' ? '#f5a623' : d.estado === 'saldada' ? '#00d97e' : '#6a6a80',
                  textTransform: 'uppercase' as const,
                }}>{d.estado}</span>
                {d.estado === 'pendiente' && (
                  <>
                    <button onClick={() => saldar(d)} title="Marcar saldada"
                      style={{ padding: '5px 10px', background: 'rgba(0,217,126,.15)', border: '1px solid #00d97e55', color: '#00d97e', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      ✓ Saldar
                    </button>
                    <button onClick={() => cancelar(d)} title="Cancelar"
                      style={{ padding: '5px 10px', background: 'rgba(106,106,128,.15)', border: '1px solid #6a6a80', color: '#a0a0b8', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      ✗
                    </button>
                  </>
                )}
                <button onClick={() => setEditing(d)} style={btnIconSmall('#5e72e4')}><i className="fas fa-pen" /></button>
                <button onClick={() => eliminar(d)} style={btnIconSmall('#f5365c')}><i className="fas fa-trash" /></button>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <DeudaModal
          agenciaId={agenciaId}
          currentUser={currentUser}
          clientes={clientes}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function DeudaModal({ agenciaId, currentUser, clientes, item, onClose, onSaved }: {
  agenciaId: string; currentUser: CurrentUser; clientes: Cliente[]; item: Partial<DeudaContenido>; onClose: () => void; onSaved: () => void
}) {
  const [clienteId, setClienteId] = useState<number | ''>(item.cliente_id ?? '')
  const [cicloOrigen, setCicloOrigen] = useState(item.ciclo_origen ?? '')
  const [cantidad, setCantidad] = useState(item.cantidad ?? 1)
  const [signo, setSigno] = useState<'+' | '-'>(item.cantidad && item.cantidad < 0 ? '-' : '+')
  const [motivo, setMotivo] = useState(item.motivo ?? '')
  const [notas, setNotas] = useState(item.notas ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = !item.id

  const save = async () => {
    if (!clienteId) { setError('Cliente requerido'); return }
    if (!cicloOrigen.trim()) { setError('Ciclo origen requerido (ej: mayo-2026)'); return }
    const absCant = Math.abs(Number(cantidad))
    if (!absCant || absCant === 0) { setError('Cantidad debe ser != 0'); return }
    setSaving(true); setError(null)
    const payload = {
      agencia_id: agenciaId,
      cliente_id: Number(clienteId),
      ciclo_origen: cicloOrigen.trim(),
      cantidad: signo === '-' ? -absCant : absCant,
      motivo: motivo.trim() || null,
      notas: notas.trim() || null,
      origen: item.origen ?? 'manual',
      creado_por: currentUser.name,
      updated_at: new Date().toISOString(),
    }
    const { error: e } = isNew
      ? await supabase.from('deudas_contenido').insert(payload)
      : await supabase.from('deudas_contenido').update(payload).eq('id', item.id!)
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved()
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <h3 style={{ margin: 0, marginBottom: 14, color: '#fff' }}>
          {isNew ? 'Sumar deuda' : 'Editar deuda'}
        </h3>
        <Field label="Cliente">
          <select value={clienteId} onChange={e => setClienteId(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
            <option value="">— Seleccionar —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Ciclo origen">
            <input value={cicloOrigen} onChange={e => setCicloOrigen(e.target.value)} placeholder="mayo-2026" style={inputStyle} />
          </Field>
          <Field label="Cantidad">
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={signo} onChange={e => setSigno(e.target.value as '+' | '-')} style={{ ...inputStyle, width: 60, padding: '8px 6px' }}>
                <option value="+">+</option>
                <option value="-">-</option>
              </select>
              <input type="number" min={1} value={Math.abs(Number(cantidad))} onChange={e => setCantidad(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }} />
            </div>
          </Field>
        </div>
        <div style={{ fontSize: 11, color: '#6a6a80', marginTop: -6, marginBottom: 8 }}>
          + = debemos al cliente; − = saldo a favor (subimos más de lo pactado)
        </div>
        <Field label="Motivo">
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="ej: faltó subir 3 reels del ciclo de mayo" style={inputStyle} />
        </Field>
        <Field label="Notas (opcional)">
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' as const }} />
        </Field>
        {error && <div style={errorBox}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} disabled={saving} style={btnSecondary}>Cancelar</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

// ============== styles ==============
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: '#5e72e4', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #2a2a40', color: '#a0a0b8', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
function btnIconSmall(color: string): React.CSSProperties {
  return { width: 26, height: 26, borderRadius: 5, background: color + '15', border: `1px solid ${color}33`, color, cursor: 'pointer', fontSize: 10 }
}
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#0a0a0f', border: '1px solid #2a2a40', borderRadius: 6, color: '#e8e8f0', fontSize: 13, outline: 'none' }
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
const modalBox: React.CSSProperties = { width: '100%', maxWidth: 500, background: '#12121a', border: '1px solid #2a2a40', borderRadius: 14, padding: '22px 24px' }
const errorBox: React.CSSProperties = { padding: '8px 12px', borderRadius: 6, background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)', color: '#f5365c', fontSize: 12, fontWeight: 600, marginBottom: 8 }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}
