'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import type { UserArea } from '@/lib/users'

type Props = {
  clientes: Cliente[]
  onClose: () => void
  onSaved: () => void
}

const AREAS: { id: UserArea; label: string; icon: string }[] = [
  { id: 'copys',  label: 'Copys',  icon: '✍️' },
  { id: 'grab',   label: 'Grab',   icon: '🎥' },
  { id: 'edit',   label: 'Edit',   icon: '✂️' },
  { id: 'diseno', label: 'Diseño', icon: '🎨' },
  { id: 'subida', label: 'Subida', icon: '🚀' },
]

type RowState = {
  cliente: Cliente
  standby: boolean
  exclusiones: Set<UserArea>
  dirty: boolean
}

export default function StandbyExclusionesModal({ clientes, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<RowState[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'todos' | 'standby' | 'exclusiones'>('todos')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    setRows(clientes.map(c => ({
      cliente: c,
      standby: c.standby ?? false,
      exclusiones: new Set<UserArea>((c.secciones_excluidas as UserArea[] | null) ?? []),
      dirty: false,
    })))
  }, [clientes])

  const filtered = useMemo(() => {
    let list = rows
    if (search) {
      list = list.filter(r => r.cliente.nombre.toLowerCase().includes(search.toLowerCase()))
    }
    if (filter === 'standby') list = list.filter(r => r.standby)
    else if (filter === 'exclusiones') list = list.filter(r => r.exclusiones.size > 0)
    return list
  }, [rows, search, filter])

  const dirtyCount = useMemo(() => rows.filter(r => r.dirty).length, [rows])

  const toggleStandby = (id: number) => {
    setRows(prev => prev.map(r =>
      r.cliente.id === id ? { ...r, standby: !r.standby, dirty: true } : r
    ))
  }

  const toggleExclusion = (id: number, area: UserArea) => {
    setRows(prev => prev.map(r => {
      if (r.cliente.id !== id) return r
      const next = new Set(r.exclusiones)
      if (next.has(area)) next.delete(area)
      else next.add(area)
      return { ...r, exclusiones: next, dirty: true }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSavedCount(0)
    const dirty = rows.filter(r => r.dirty)
    let success = 0
    for (const r of dirty) {
      const { error: e } = await supabase
        .from('clientes')
        .update({
          standby: r.standby,
          secciones_excluidas: Array.from(r.exclusiones),
        })
        .eq('id', r.cliente.id)
      if (e) {
        setError(`Error en ${r.cliente.nombre}: ${e.message}`)
        break
      }
      success++
      setSavedCount(success)
    }
    setSaving(false)
    if (success === dirty.length && success > 0) {
      onSaved()
    } else if (success === 0 && dirty.length === 0) {
      onClose()
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 920,
          maxHeight: '90vh',
          background: '#12121a',
          border: '1px solid #2a2a40',
          borderRadius: 14,
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2a40', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#fff' }}>
              <i className="fas fa-pause-circle" style={{ color: '#f5a623', marginRight: 8 }} />
              Standby & Exclusiones
            </h3>
            <p style={{ fontSize: 11, color: '#6a6a80', margin: 0, marginTop: 2 }}>
              Pausá clientes temporalmente o excluilos de áreas que no aplican
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#6a6a80',
            fontSize: 18, cursor: 'pointer', padding: 4,
          }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #2a2a40', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Buscar cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200, padding: '6px 12px',
              background: '#1a1a28', border: '1px solid #2a2a40',
              borderRadius: 6, color: '#e8e8f0', fontSize: 13, outline: 'none',
            }}
          />
          {(['todos', 'standby', 'exclusiones'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px',
                background: filter === f ? '#5e72e4' : '#1a1a28',
                border: `1px solid ${filter === f ? '#5e72e4' : '#2a2a40'}`,
                borderRadius: 6,
                color: filter === f ? '#fff' : '#a0a0b8',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize' as const,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Header de columnas */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 90px repeat(5, 70px)', gap: 8,
          padding: '8px 24px', borderBottom: '1px solid #2a2a40',
          fontSize: 10, color: '#6a6a80', fontWeight: 700,
          textTransform: 'uppercase' as const, letterSpacing: 0.4,
        }}>
          <span>Cliente</span>
          <span style={{ textAlign: 'center' as const }}>Standby</span>
          {AREAS.map(a => <span key={a.id} style={{ textAlign: 'center' as const }}>{a.icon} {a.label}</span>)}
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80', fontSize: 13 }}>
              Sin resultados
            </div>
          ) : filtered.map(r => (
            <div key={r.cliente.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 90px repeat(5, 70px)', gap: 8,
              padding: '10px 24px', borderBottom: '1px solid rgba(42,42,64,.5)',
              alignItems: 'center',
              background: r.dirty ? 'rgba(245,166,35,.06)' : 'transparent',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                  {r.cliente.nombre}
                  {r.dirty && <span style={{ marginLeft: 6, color: '#f5a623', fontSize: 10 }}>● modificado</span>}
                </div>
                <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2 }}>
                  {r.cliente.estado || '—'}
                </div>
              </div>

              {/* Standby toggle */}
              <button
                onClick={() => toggleStandby(r.cliente.id)}
                style={{
                  padding: '4px 0', borderRadius: 6,
                  background: r.standby ? '#f5a623' : '#1a1a28',
                  border: `1px solid ${r.standby ? '#f5a623' : '#2a2a40'}`,
                  color: r.standby ? '#0a0a0f' : '#a0a0b8',
                  fontSize: 16, cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {r.standby ? '⏸' : '○'}
              </button>

              {/* Exclusion toggles per area */}
              {AREAS.map(a => {
                const excluded = r.exclusiones.has(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleExclusion(r.cliente.id, a.id)}
                    title={excluded ? `Excluido de ${a.label}` : `Incluir en ${a.label}`}
                    style={{
                      padding: '4px 0', borderRadius: 6,
                      background: excluded ? 'rgba(245,54,92,.15)' : '#1a1a28',
                      border: `1px solid ${excluded ? '#f5365c' : '#2a2a40'}`,
                      color: excluded ? '#f5365c' : '#3a3a55',
                      fontSize: 14, cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    {excluded ? '🚫' : '○'}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #2a2a40', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: '#6a6a80' }}>
            {dirtyCount > 0 ? (
              <><span style={{ color: '#f5a623', fontWeight: 700 }}>{dirtyCount}</span> cambio{dirtyCount !== 1 ? 's' : ''} pendiente{dirtyCount !== 1 ? 's' : ''}</>
            ) : (
              <span style={{ opacity: 0.5 }}>Sin cambios</span>
            )}
            {savedCount > 0 && saving && <span style={{ marginLeft: 8 }}>· {savedCount}/{dirtyCount} guardados</span>}
          </div>
          {error && (
            <div style={{ fontSize: 11, color: '#f5365c', marginRight: 12 }}>
              <i className="fas fa-circle-exclamation" /> {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} disabled={saving}
              style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #2a2a40', borderRadius: 6, color: '#a0a0b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || dirtyCount === 0}
              style={{
                padding: '8px 18px', background: dirtyCount > 0 ? '#5e72e4' : '#2a2a40',
                border: 'none', borderRadius: 6, color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: dirtyCount > 0 ? 'pointer' : 'not-allowed',
                opacity: saving ? 0.6 : 1,
              }}>
              {saving ? `Guardando ${savedCount}/${dirtyCount}…` : `Guardar ${dirtyCount > 0 ? `(${dirtyCount})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
