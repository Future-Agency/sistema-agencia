'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type Equipo, type Pieza } from '@/lib/supabase'
import type { UserArea } from '@/lib/users'
import { cicloMesLabel } from '@/lib/cycles'
import { AREA_TO_PIEZA_FIELD, AREA_TO_ROL } from './BatchAsignadoSelector'

type Props = {
  agenciaId: string
  clientes: Cliente[]
  equipo: Equipo[]
  cicloActual?: string  // para filtrar tareas del ciclo activo
}

type Tarea = {
  cliente: Cliente
  ciclo: string
  area: UserArea
  cantidadPiezas: number
}

const AREAS_ASIGNABLES: UserArea[] = ['copys', 'edit', 'diseno', 'subida']
const AREA_LABEL: Record<UserArea, { label: string; emoji: string; color: string }> = {
  copys:    { label: 'Copys',   emoji: '✍️', color: '#5e72e4' },
  grab:     { label: 'Grab',    emoji: '🎥', color: '#f5a623' },
  edit:     { label: 'Edición', emoji: '✂️', color: '#fb6340' },
  diseno:   { label: 'Diseño',  emoji: '🎨', color: '#ec4ad8' },
  subida:   { label: 'Subida',  emoji: '🚀', color: '#00d97e' },
  anuncios: { label: 'Anuncios', emoji: '📢', color: '#a78bfa' },
}

export default function TableroEquipo({ agenciaId, clientes, equipo, cicloActual }: Props) {
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroArea, setFiltroArea] = useState<UserArea | 'todas'>('todas')

  const fetchPiezas = useCallback(async () => {
    const PAGE = 1000
    const all: Pieza[] = []
    for (let page = 0; ; page++) {
      let query = supabase.from('piezas').select('*')
        .eq('agencia_id', agenciaId)
        .range(page * PAGE, (page + 1) * PAGE - 1)
      if (cicloActual) query = query.eq('ciclo_mes', cicloActual)
      const { data } = await query
      const rows = (data ?? []) as Pieza[]
      all.push(...rows)
      if (rows.length < PAGE) break
    }
    setPiezas(all)
  }, [agenciaId, cicloActual])

  const reload = useCallback(async () => {
    setLoading(true)
    await fetchPiezas()
    setLoading(false)
  }, [fetchPiezas])

  useEffect(() => { reload() }, [reload])

  // Listener silencioso para refreshes cross-tab
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { fetchPiezas() }
    window.addEventListener('estado-loop-changed', handler)
    window.addEventListener('clientes-refresh', handler)
    return () => {
      window.removeEventListener('estado-loop-changed', handler)
      window.removeEventListener('clientes-refresh', handler)
    }
  }, [fetchPiezas])

  const clienteById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])

  // Por cada miembro del equipo: lista de tareas activas (cliente × ciclo × área).
  // "Tarea activa" = al menos una pieza del cliente×ciclo×área asignada a esa persona
  // y con estado NO terminal en esa área.
  const tareasPorPersona = useMemo(() => {
    const result = new Map<string, Tarea[]>()
    for (const e of equipo) result.set(e.id, [])

    for (const area of AREAS_ASIGNABLES) {
      if (filtroArea !== 'todas' && filtroArea !== area) continue
      const field = AREA_TO_PIEZA_FIELD[area]
      if (!field) continue
      const stateCol = area === 'edit' ? 'estado_edicion' : `estado_${area}`
      // Agrupar por (persona, cliente, ciclo)
      const buckets = new Map<string, { persona: string; cliente: number; ciclo: string; count: number }>()
      for (const p of piezas) {
        const personaId = (p as Record<string, unknown>)[field as string] as string | null
        if (!personaId) continue
        const estado = (p as Record<string, unknown>)[stateCol] as string | null
        // Sólo cuento tareas no terminadas (sin estado o no aprobado)
        if (estado && /^(APROBADO|LISTO PARA GRABAR|PUBLICADO|MATERIAL APROBADO|MATERIAL SUBIDO|METRICAS Y VOLVER A EMPEZAR|VOLVER A EMPEZAR)$/i.test(estado)) continue
        const k = `${personaId}::${p.cliente_id}::${p.ciclo_mes}`
        if (!buckets.has(k)) buckets.set(k, { persona: personaId, cliente: p.cliente_id, ciclo: p.ciclo_mes, count: 0 })
        buckets.get(k)!.count++
      }
      Array.from(buckets.values()).forEach(b => {
        const c = clienteById.get(b.cliente)
        if (!c) return
        if (!result.has(b.persona)) result.set(b.persona, [])
        result.get(b.persona)!.push({ cliente: c, ciclo: b.ciclo, area, cantidadPiezas: b.count })
      })
    }
    return result
  }, [piezas, equipo, clienteById, filtroArea])

  // Stats agregadas (sin asignar por área)
  const sinAsignarPorArea = useMemo(() => {
    const result: Partial<Record<UserArea, number>> = {}
    for (const area of AREAS_ASIGNABLES) {
      const field = AREA_TO_PIEZA_FIELD[area]
      if (!field) continue
      const stateCol = area === 'edit' ? 'estado_edicion' : `estado_${area}`
      const batchKeys = new Set<string>()
      for (const p of piezas) {
        const estado = (p as Record<string, unknown>)[stateCol] as string | null
        if (estado && /^(APROBADO|LISTO PARA GRABAR|PUBLICADO|MATERIAL APROBADO|MATERIAL SUBIDO|METRICAS Y VOLVER A EMPEZAR|VOLVER A EMPEZAR)$/i.test(estado)) continue
        const asignado = (p as Record<string, unknown>)[field as string] as string | null
        if (asignado) continue
        batchKeys.add(`${p.cliente_id}::${p.ciclo_mes}`)
      }
      result[area] = batchKeys.size
    }
    return result
  }, [piezas])

  const equipoOrdenado = useMemo(() => {
    return [...equipo].filter(e => e.activo).sort((a, b) => {
      const ta = (tareasPorPersona.get(a.id) ?? []).length
      const tb = (tareasPorPersona.get(b.id) ?? []).length
      if (tb !== ta) return tb - ta
      return a.nombre.localeCompare(b.nombre)
    })
  }, [equipo, tareasPorPersona])

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>👥 Equipo</h2>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0, marginTop: 2 }}>
            Tareas activas por persona en {cicloActual ? `el ciclo ${cicloMesLabel(cicloActual)}` : 'todos los ciclos'}.
          </p>
        </div>
        {/* Filtro por área */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
          <button onClick={() => setFiltroArea('todas')}
            style={chipStyle(filtroArea === 'todas', '#5e72e4')}>Todas</button>
          {AREAS_ASIGNABLES.map(a => (
            <button key={a} onClick={() => setFiltroArea(a)}
              style={chipStyle(filtroArea === a, AREA_LABEL[a].color)}>
              {AREA_LABEL[a].emoji} {AREA_LABEL[a].label}
            </button>
          ))}
        </div>
      </div>

      {/* Sin asignar por área */}
      {Object.entries(sinAsignarPorArea).some(([, n]) => (n ?? 0) > 0) && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.30)' }}>
          <div style={{ fontSize: 11, color: '#f5a623', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
            ⚠ Batches sin asignar
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
            {AREAS_ASIGNABLES.map(a => {
              const n = sinAsignarPorArea[a] ?? 0
              if (n === 0) return null
              return (
                <span key={a} style={{
                  fontSize: 12, color: '#e8e8f0', fontWeight: 600,
                  padding: '3px 8px', borderRadius: 5,
                  background: 'rgba(0,0,0,.25)',
                }}>
                  {AREA_LABEL[a].emoji} {AREA_LABEL[a].label}: <strong style={{ color: '#f5a623' }}>{n}</strong>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Grid de personas */}
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>Cargando…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {equipoOrdenado.map(persona => {
            const tareas = tareasPorPersona.get(persona.id) ?? []
            const carga = loadColor(tareas.length)
            return (
              <div key={persona.id} style={{
                background: '#12121a', border: '1px solid #2a2a40', borderRadius: 10,
                padding: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: persona.color, color: '#0a0a0f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 14,
                  }}>{persona.nombre[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f0' }}>{persona.nombre}</div>
                    <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>
                      {persona.rol === 'copy' ? 'Copywriter' : persona.rol === 'editor' ? 'Editor' : persona.rol === 'diseñador' ? 'Diseñador' : 'CM'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                    background: carga.bg, color: carga.color,
                  }}>{tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}</span>
                </div>
                {tareas.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#3a3a55', fontStyle: 'italic' as const, padding: '8px 0' }}>
                    Sin tareas asignadas
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
                    {tareas.slice(0, 8).map((t, i) => {
                      const ameta = AREA_LABEL[t.area]
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 8px', borderRadius: 5,
                          background: '#0f0f15', border: '1px solid #1a1a28',
                          fontSize: 11,
                        }}>
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 3,
                            background: `${ameta.color}22`, color: ameta.color, fontWeight: 700,
                          }}>{ameta.emoji} {ameta.label}</span>
                          <span style={{ flex: 1, color: '#e8e8f0', fontWeight: 600 }}>{t.cliente.nombre}</span>
                          <span style={{ fontSize: 9, color: '#6a6a80' }}>{t.cantidadPiezas}p · {cicloMesLabel(t.ciclo).split(' ')[0]}</span>
                        </div>
                      )
                    })}
                    {tareas.length > 8 && (
                      <div style={{ fontSize: 10, color: '#6a6a80', textAlign: 'center' as const, padding: 4 }}>+ {tareas.length - 8} más</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function loadColor(count: number): { color: string; bg: string } {
  if (count === 0) return { color: '#6a6a80', bg: 'rgba(106,106,128,.12)' }
  if (count <= 2) return { color: '#00d97e', bg: 'rgba(0,217,126,.12)' }
  if (count <= 4) return { color: '#f5a623', bg: 'rgba(245,166,35,.12)' }
  return { color: '#f5365c', bg: 'rgba(245,54,92,.12)' }
}

function chipStyle(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 14,
    background: active ? `${color}22` : 'transparent',
    border: `1px solid ${active ? color : '#2a2a40'}`,
    color: active ? color : '#a0a0b8',
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
  }
}
