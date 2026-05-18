'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type PedidoCliente, type PedidoClienteEstado, type PedidoClientePrioridad } from '@/lib/supabase'
import type { CurrentUser, UserArea } from '@/lib/users'

type Props = {
  agenciaId: string
  clientes: Cliente[]
  currentUser: CurrentUser
}

const ESTADOS: { id: PedidoClienteEstado; label: string; color: string; icon: string }[] = [
  { id: 'pendiente',  label: 'Pendiente',   color: '#a0a0b8', icon: '⏳' },
  { id: 'en_curso',   label: 'En curso',    color: '#5e72e4', icon: '🔄' },
  { id: 'completado', label: 'Completado',  color: '#00d97e', icon: '✅' },
  { id: 'cancelado',  label: 'Cancelado',   color: '#f5365c', icon: '🚫' },
]

const PRIORIDADES: { id: PedidoClientePrioridad; label: string; color: string }[] = [
  { id: 'baja',    label: 'Baja',    color: '#6a6a80' },
  { id: 'media',   label: 'Media',   color: '#5e72e4' },
  { id: 'alta',    label: 'Alta',    color: '#f5a623' },
  { id: 'urgente', label: 'Urgente', color: '#f5365c' },
]

const AREAS: UserArea[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']
const AREA_ICON: Record<UserArea, string> = {
  copys: '✍️', grab: '🎥', edit: '✂️', diseno: '🎨', subida: '🚀', anuncios: '📊',
}

function diffDays(target: Date, ref: Date = new Date()): number {
  return Math.floor((target.getTime() - ref.getTime()) / 86400000)
}

export default function TableroPedidosClientes({ agenciaId, clientes, currentUser }: Props) {
  const [items, setItems] = useState<PedidoCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<PedidoCliente> | null>(null)
  const [filterEstado, setFilterEstado] = useState<PedidoClienteEstado | 'all'>('all')
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'semi-admin'

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('pedidos_clientes')
      .select('*').eq('agencia_id', agenciaId)
      .order('deadline', { ascending: true, nullsFirst: false })
    if (error) {
      console.warn('[pedidos_clientes] query error:', error)
      setItems([])
    } else {
      setItems((data ?? []) as PedidoCliente[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [agenciaId])

  const filtered = useMemo(() => {
    if (filterEstado === 'all') return items
    return items.filter(p => p.estado === filterEstado)
  }, [items, filterEstado])

  const counts = useMemo(() => {
    const m: Record<PedidoClienteEstado, number> = { pendiente: 0, en_curso: 0, completado: 0, cancelado: 0 }
    items.forEach(p => { m[p.estado]++ })
    return m
  }, [items])

  const clienteById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap' as const, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📦 Pedidos Clientes</h2>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0, marginTop: 2 }}>
            Pedidos one-off por fuera del ciclo regular
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setEditing({ nombre: '', estado: 'pendiente', prioridad: 'media', areas: [] })}
            style={btnPrimary}>
            <i className="fas fa-plus" style={{ marginRight: 6 }} />Nuevo pedido
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' as const }}>
        <FilterChip label="Todos" count={items.length} active={filterEstado === 'all'} onClick={() => setFilterEstado('all')} color="#a0a0b8" />
        {ESTADOS.map(e => (
          <FilterChip key={e.id} label={`${e.icon} ${e.label}`} count={counts[e.id]}
            active={filterEstado === e.id} onClick={() => setFilterEstado(e.id)} color={e.color} />
        ))}
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <p style={{ fontSize: 13 }}>{items.length === 0 ? 'Sin pedidos registrados.' : 'Sin pedidos en este filtro.'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
          {filtered.map(p => (
            <PedidoCard key={p.id} p={p}
              cliente={p.cliente_id ? clienteById.get(p.cliente_id) : null}
              canEdit={canEdit}
              onEdit={() => setEditing(p)}
              onDelete={async () => {
                if (!window.confirm(`Borrar "${p.nombre}"?`)) return
                await supabase.from('pedidos_clientes').delete().eq('id', p.id)
                load()
              }}
              onUpdateState={async (newState) => {
                await supabase.from('pedidos_clientes').update({ estado: newState, updated_at: new Date().toISOString() }).eq('id', p.id)
                load()
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <PedidoModal
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

function FilterChip({ label, count, active, onClick, color }: { label: string; count: number; active: boolean; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 12px',
      background: active ? color + '22' : '#1a1a28',
      border: `1px solid ${active ? color : '#2a2a40'}`,
      borderRadius: 18, color: active ? color : '#a0a0b8',
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
    }}>
      {label}
      <span style={{ background: '#0a0a0f', padding: '0 6px', borderRadius: 8, fontSize: 10 }}>{count}</span>
    </button>
  )
}

function PedidoCard({ p, cliente, canEdit, onEdit, onDelete, onUpdateState }: {
  p: PedidoCliente; cliente: Cliente | null | undefined; canEdit: boolean
  onEdit: () => void; onDelete: () => void
  onUpdateState: (s: PedidoClienteEstado) => void
}) {
  const estadoMeta = ESTADOS.find(e => e.id === p.estado)!
  const prioridadMeta = PRIORIDADES.find(x => x.id === p.prioridad)!
  const dlDays = p.deadline ? diffDays(new Date(p.deadline)) : null

  return (
    <div style={{
      padding: '14px 16px', background: '#1a1a28',
      border: `1px solid ${p.estado === 'cancelado' ? '#2a2a40' : estadoMeta.color + '33'}`,
      borderRadius: 10,
      opacity: p.estado === 'completado' || p.estado === 'cancelado' ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nombre}</div>
          {cliente && (
            <div style={{ fontSize: 11, color: '#a0a0b8', marginTop: 2 }}>👤 {cliente.nombre}</div>
          )}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onEdit} style={btnIcon('#5e72e4')}><i className="fas fa-pen" /></button>
            <button onClick={onDelete} style={btnIcon('#f5365c')}><i className="fas fa-trash" /></button>
          </div>
        )}
      </div>

      {p.descripcion && (
        <div style={{ fontSize: 11, color: '#a0a0b8', marginBottom: 8, lineHeight: 1.4 }}>
          {p.descripcion}
        </div>
      )}

      {/* Meta line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8 }}>
        {/* Areas que APLICAN */}
        {p.areas.map(a => (
          <span key={`a-${a}`} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 3,
            background: 'rgba(0,217,126,.10)', color: '#00d97e',
            border: '1px solid rgba(0,217,126,.30)',
          }}>
            ✓ {AREA_ICON[a as UserArea] || ''} {a}
          </span>
        ))}
        {/* Areas que NO APLICAN */}
        {(p.areas_no_aplica ?? []).map(a => (
          <span key={`n-${a}`} style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 3,
            background: 'rgba(245,54,92,.08)', color: '#f5365c',
            border: '1px solid rgba(245,54,92,.25)',
            textDecoration: 'line-through' as const,
          }}>
            ✗ {AREA_ICON[a as UserArea] || ''} {a}
          </span>
        ))}
        {/* Prioridad */}
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
          background: prioridadMeta.color + '22', color: prioridadMeta.color,
          textTransform: 'uppercase' as const, letterSpacing: 0.3,
        }}>
          {prioridadMeta.label}
        </span>
        {/* Responsable */}
        {p.responsable && (
          <span style={{ fontSize: 10, color: '#6a6a80' }}>· {p.responsable}</span>
        )}
      </div>

      {/* Deadline + estado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11 }}>
          {dlDays != null ? (
            <span style={{ color: dlDays < 0 ? '#f5365c' : dlDays <= 3 ? '#f5a623' : '#6a6a80' }}>
              <i className="fas fa-clock" style={{ marginRight: 3 }} />
              {dlDays < 0 ? `${Math.abs(dlDays)}d vencido` : dlDays === 0 ? 'hoy' : `en ${dlDays}d`}
            </span>
          ) : (
            <span style={{ color: '#6a6a80' }}>Sin deadline</span>
          )}
        </div>
        {/* Estado dropdown si admin */}
        {canEdit ? (
          <select value={p.estado} onChange={e => onUpdateState(e.target.value as PedidoClienteEstado)}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 6px',
              background: estadoMeta.color + '22', border: `1px solid ${estadoMeta.color}55`,
              borderRadius: 4, color: estadoMeta.color, cursor: 'pointer',
            }}>
            {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
          </select>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: estadoMeta.color + '22', color: estadoMeta.color,
          }}>
            {estadoMeta.icon} {estadoMeta.label}
          </span>
        )}
      </div>
    </div>
  )
}

function PedidoModal({ agenciaId, currentUser, clientes, item, onClose, onSaved }: {
  agenciaId: string; currentUser: CurrentUser; clientes: Cliente[]; item: Partial<PedidoCliente>
  onClose: () => void; onSaved: () => void
}) {
  const [nombre, setNombre] = useState(item.nombre ?? '')
  const [descripcion, setDescripcion] = useState(item.descripcion ?? '')
  const [clienteId, setClienteId] = useState<number | ''>(item.cliente_id ?? '')
  const [areas, setAreas] = useState<Set<UserArea>>(new Set((item.areas ?? []) as UserArea[]))
  const [areasNoAplica, setAreasNoAplica] = useState<Set<UserArea>>(new Set((item.areas_no_aplica ?? []) as UserArea[]))
  const [deadline, setDeadline] = useState(item.deadline ?? '')
  const [estado, setEstado] = useState<PedidoClienteEstado>(item.estado ?? 'pendiente')
  const [prioridad, setPrioridad] = useState<PedidoClientePrioridad>(item.prioridad ?? 'media')
  const [responsable, setResponsable] = useState(item.responsable ?? '')
  const [notas, setNotas] = useState(item.notas ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = !item.id

  // Tri-state: sin marcar → aplica → no aplica → sin marcar
  const cycleAreaState = (a: UserArea) => {
    const isAplica = areas.has(a)
    const isNoAplica = areasNoAplica.has(a)
    const aSet = new Set(areas)
    const nSet = new Set(areasNoAplica)
    if (!isAplica && !isNoAplica) {
      // sin marcar → aplica
      aSet.add(a)
    } else if (isAplica) {
      // aplica → no aplica
      aSet.delete(a); nSet.add(a)
    } else {
      // no aplica → sin marcar
      nSet.delete(a)
    }
    setAreas(aSet); setAreasNoAplica(nSet)
  }
  const getAreaState = (a: UserArea): 'aplica' | 'no_aplica' | 'sin_marcar' =>
    areas.has(a) ? 'aplica' : areasNoAplica.has(a) ? 'no_aplica' : 'sin_marcar'

  const save = async () => {
    if (!nombre.trim()) { setError('Nombre requerido'); return }
    setSaving(true)
    setError(null)
    const payload = {
      agencia_id: agenciaId,
      cliente_id: clienteId === '' ? null : Number(clienteId),
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      areas: Array.from(areas),
      areas_no_aplica: Array.from(areasNoAplica),
      deadline: deadline || null,
      estado, prioridad,
      responsable: responsable.trim() || null,
      notas: notas.trim() || null,
      creado_por: currentUser.name,
      updated_at: new Date().toISOString(),
    }
    const { error: e } = isNew
      ? await supabase.from('pedidos_clientes').insert(payload)
      : await supabase.from('pedidos_clientes').update(payload).eq('id', item.id!)
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved()
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 560 }}>
        <h3 style={{ margin: 0, marginBottom: 14, color: '#fff' }}>
          {isNew ? 'Nuevo pedido' : 'Editar pedido'}
        </h3>

        <Field label="Nombre">
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Video YouTube X" style={inputStyle} />
        </Field>

        <Field label="Cliente">
          <select value={clienteId} onChange={e => setClienteId(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
            <option value="">— Sin cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>

        <Field label="Áreas (click cicla: sin marcar → aplica → no aplica)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {AREAS.map(a => {
              const st = getAreaState(a)
              const isAplica = st === 'aplica'
              const isNoAplica = st === 'no_aplica'
              const bg = isAplica ? '#00d97e22' : isNoAplica ? '#f5365c22' : '#0a0a0f'
              const border = isAplica ? '#00d97e' : isNoAplica ? '#f5365c' : '#2a2a40'
              const color = isAplica ? '#00d97e' : isNoAplica ? '#f5365c' : '#a0a0b8'
              return (
                <button key={a} onClick={() => cycleAreaState(a)}
                  title={isAplica ? 'Aplica' : isNoAplica ? 'No aplica' : 'Sin marcar (click para alternar)'}
                  style={{
                    position: 'relative' as const,
                    padding: '8px 4px', borderRadius: 6,
                    background: bg,
                    border: `1px solid ${border}`,
                    color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {isAplica && <span style={{ position: 'absolute' as const, top: 2, right: 4, fontSize: 9 }}>✓</span>}
                  {isNoAplica && <span style={{ position: 'absolute' as const, top: 2, right: 4, fontSize: 9 }}>✗</span>}
                  <div style={{ fontSize: 14 }}>{AREA_ICON[a]}</div>
                  {a}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Descripción">
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' as const }} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Deadline">
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Responsable">
            <input value={responsable} onChange={e => setResponsable(e.target.value)} placeholder={currentUser.name} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Estado">
            <select value={estado} onChange={e => setEstado(e.target.value as PedidoClienteEstado)} style={inputStyle}>
              {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.icon} {e.label}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select value={prioridad} onChange={e => setPrioridad(e.target.value as PedidoClientePrioridad)} style={inputStyle}>
              {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notas">
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

function Loading() {
  return <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80', fontSize: 13 }}>Cargando…</div>
}

// Shared styles
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: '#5e72e4', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', border: '1px solid #2a2a40',
  color: '#a0a0b8', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
function btnIcon(color: string): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 6,
    background: color + '22', border: `1px solid ${color}33`, color,
    cursor: 'pointer', fontSize: 11,
  }
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: '#0a0a0f', border: '1px solid #2a2a40',
  borderRadius: 6, color: '#e8e8f0', fontSize: 13,
  outline: 'none',
}
const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, overflow: 'auto' as const,
}
const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 460,
  background: '#12121a', border: '1px solid #2a2a40',
  borderRadius: 14, padding: '22px 24px',
  maxHeight: '90vh', overflowY: 'auto' as const,
}
const errorBox: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6,
  background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
  color: '#f5365c', fontSize: 12, fontWeight: 600, marginBottom: 8,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
