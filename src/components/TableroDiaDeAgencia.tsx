'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type Equipo, type EstadoLog, type Owner, type Pieza } from '@/lib/supabase'
import type { UserArea } from '@/lib/users'
import { AREA_DEFS } from '@/lib/areaStates'
import { PIPELINE_BY_TIPO, diasEnEstadoBatch, colorPorDiasEnEstado } from '@/lib/piezas'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const AREA_COLOR: Record<UserArea, string> = {
  copys: '#5e72e4', grab: '#f5a623', edit: '#fb6340',
  diseno: '#ec4ad8', subida: '#00d97e', anuncios: '#11cdef',
}

// Use to avoid unused warnings
void ymd; void AREA_COLOR; void supabase; void useCallback; void useEffect;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _EstadoLogUnused: EstadoLog | null = null

type Props = {
  clientes: Cliente[]
  equipo: Equipo[]
  owners: Owner[]
  piezas: Pieza[]
  onSelectCliente?: (c: Cliente) => void
}

const AREA_LABEL: Record<UserArea, string> = {
  copys: 'Copys', grab: 'Grab', edit: 'Edición', diseno: 'Diseño', subida: 'Subida', anuncios: 'Anuncios',
}

const APPROVED_VALUES = new Set([
  'APROBADO', 'APROBADO - SUBIDA A CLICKUP', 'PUBLICADO',
  'METRICAS Y VOLVER A EMPEZAR', 'MÉTRICAS Y VOLVER A EMPEZAR',
  'VOLVER A EMPEZAR', 'MATERIAL APROBADO', 'MATERIAL SUBIDO', 'LISTO PARA GRABAR',
])
function isApproved(v: string | null | undefined): boolean {
  if (!v) return false
  return APPROVED_VALUES.has(v.toUpperCase())
}
function colFor(a: UserArea): string { return a === 'edit' ? 'estado_edicion' : `estado_${a}` }
function asignadoFieldFor(a: UserArea): keyof Pieza | null {
  switch (a) {
    case 'copys':  return 'copywriter_id'
    case 'edit':   return 'editor_id'
    case 'diseno': return 'disenador_id'
    case 'subida': return 'cm_id'
    default: return null
  }
}

type BatchActivo = {
  key: string
  clienteId: number
  clienteNombre: string
  ciclo: string
  area: UserArea
  estado: string
  piezas: Pieza[]
  dias: number | null
  asignadoId: string | null
}

export default function TableroDiaDeAgencia({ clientes, equipo, owners, piezas, onSelectCliente }: Props) {
  const [filtroMiembro, setFiltroMiembro] = useState<string>('') // equipo.id o 'owner:XXX' o ''
  const [filtroArea, setFiltroArea] = useState<UserArea | ''>('')

  const clienteById = useMemo(() => new Map(clientes.map(c => [c.id, c])), [clientes])
  const ownerById = useMemo(() => new Map(owners.map(o => [o.id, o])), [owners])
  const equipoById = useMemo(() => new Map(equipo.map(e => [e.id, e])), [equipo])

  // Construir todos los batches activos del equipo (cliente×ciclo×area)
  const batches = useMemo<BatchActivo[]>(() => {
    const map = new Map<string, BatchActivo>()
    const AREAS_ORDER: UserArea[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']
    for (const a of AREAS_ORDER) {
      // Para cada area, filtrar piezas que actualmente están ahí
      for (const p of piezas) {
        const pipeline = PIPELINE_BY_TIPO[p.tipo]
        if (!pipeline.includes(a)) continue
        const idx = pipeline.indexOf(a)
        // Áreas previas todas aprobadas?
        let prevOk = true
        for (let i = 0; i < idx; i++) {
          const v = (p as Record<string, unknown>)[colFor(pipeline[i])] as string | null
          if (!isApproved(v)) { prevOk = false; break }
        }
        if (!prevOk) continue
        const v = (p as Record<string, unknown>)[colFor(a)] as string | null
        if (isApproved(v) && idx !== pipeline.length - 1) continue
        // Pieza activa en este área
        const key = `${p.cliente_id}::${p.ciclo_mes}::${a}`
        let b = map.get(key)
        if (!b) {
          const c = clienteById.get(p.cliente_id)
          if (!c) continue
          const asignadoField = asignadoFieldFor(a)
          const asignadoId = asignadoField ? ((p as Record<string, unknown>)[asignadoField] as string | null) : null
          b = { key, clienteId: c.id, clienteNombre: c.nombre, ciclo: p.ciclo_mes, area: a, estado: (v || '').trim() || AREA_DEFS[a].states[0].label, piezas: [], dias: null, asignadoId }
          map.set(key, b)
        }
        b.piezas.push(p)
      }
    }
    // Calcular días
    map.forEach(b => { b.dias = diasEnEstadoBatch(b.piezas) })
    return Array.from(map.values())
  }, [piezas, clienteById])

  // Filtrar
  const visibles = useMemo(() => {
    let list = batches
    if (filtroArea) list = list.filter(b => b.area === filtroArea)
    if (filtroMiembro) {
      if (filtroMiembro.startsWith('owner:')) {
        const oid = filtroMiembro.slice(6)
        list = list.filter(b => clienteById.get(b.clienteId)?.owner_id === oid)
      } else {
        list = list.filter(b => b.asignadoId === filtroMiembro)
      }
    }
    return list
  }, [batches, filtroArea, filtroMiembro, clienteById])

  // Agrupar por miembro
  const porMiembro = useMemo(() => {
    const m = new Map<string, BatchActivo[]>()
    for (const b of visibles) {
      const k = b.asignadoId ? `equipo:${b.asignadoId}` : `owner:${clienteById.get(b.clienteId)?.owner_id ?? '__none__'}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(b)
    }
    return m
  }, [visibles, clienteById])

  const grupoLabel = (k: string): { nombre: string; color: string; rol: string } => {
    if (k.startsWith('equipo:')) {
      const id = k.slice(7)
      const e = equipoById.get(id)
      return e ? { nombre: e.nombre, color: e.color, rol: e.rol } : { nombre: 'Desconocido', color: '#6a6a80', rol: '—' }
    } else {
      const id = k.slice(6)
      if (id === '__none__') return { nombre: 'Sin owner', color: '#6a6a80', rol: 'owner' }
      const o = ownerById.get(id)
      return o ? { nombre: o.nombre, color: o.color, rol: 'owner' } : { nombre: 'Owner desconocido', color: '#6a6a80', rol: 'owner' }
    }
  }

  // Stats
  const totalBatches = visibles.length
  const totalMiembros = porMiembro.size

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📅 Día de la Agencia</h2>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0, marginTop: 2 }}>
            Qué está haciendo cada miembro hoy. <strong>{totalBatches}</strong> tareas activas en <strong>{totalMiembros}</strong> personas.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <select value={filtroArea} onChange={e => setFiltroArea(e.target.value as UserArea | '')} style={selectStyle}>
            <option value="">Todas las áreas</option>
            {(['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios'] as UserArea[]).map(a => (
              <option key={a} value={a}>{AREA_LABEL[a]}</option>
            ))}
          </select>
          <select value={filtroMiembro} onChange={e => setFiltroMiembro(e.target.value)} style={selectStyle}>
            <option value="">Todos los miembros</option>
            <optgroup label="Equipo">
              {equipo.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre} ({e.rol})</option>)}
            </optgroup>
            <optgroup label="Owners">
              {owners.map(o => <option key={o.id} value={`owner:${o.id}`}>{o.nombre} (owner)</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      {visibles.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌴</div>
          <p style={{ fontSize: 13 }}>Sin tareas activas con los filtros actuales.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
          {(() => { const arr: Array<[string, BatchActivo[]]> = []; porMiembro.forEach((v, k) => arr.push([k, v])); return arr })().map(([k, list]) => {
            const g = grupoLabel(k)
            // Ordenar por días en estado desc (los más viejos primero)
            const sorted = [...list].sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
            return (
              <div key={k} style={{
                background: '#1a1a28', border: '1px solid #2a2a40',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: g.color, color: '#0a0a0f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 13,
                  }}>{g.nombre[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{g.nombre}</div>
                    <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>{g.rol}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#a0a0b8' }}>{sorted.length} tarea{sorted.length === 1 ? '' : 's'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {sorted.map(b => {
                    const col = colorPorDiasEnEstado(b.dias ?? 0)
                    return (
                      <div key={b.key}
                        onClick={() => { const c = clienteById.get(b.clienteId); if (c && onSelectCliente) onSelectCliente(c) }}
                        style={{
                          padding: '8px 10px', borderRadius: 6,
                          background: '#0f0f15', border: '1px solid #2a2a40',
                          cursor: onSelectCliente ? 'pointer' : 'default',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{b.clienteNombre}</span>
                          {b.dias !== null && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                              background: col.bg, border: `1px solid ${col.border}`, color: col.color,
                            }}>{b.dias}d</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#6a6a80' }}>
                          <span style={{ color: AREA_DEFS[b.area].primaryColor, fontWeight: 700 }}>{AREA_LABEL[b.area]}</span>
                          <span>·</span>
                          <span style={{ color: '#a0a0b8' }}>{b.estado}</span>
                        </div>
                        <div style={{ fontSize: 9, color: '#3a3a55', marginTop: 2, textTransform: 'capitalize' as const }}>
                          Ciclo {b.ciclo} · {b.piezas.length} pieza{b.piezas.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 6,
  color: '#e8e8f0', fontSize: 12, padding: '6px 10px', cursor: 'pointer',
}
