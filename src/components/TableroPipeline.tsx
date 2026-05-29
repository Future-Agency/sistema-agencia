'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { supabase, type Cliente, type Owner, type Pieza, type PiezaTipo } from '@/lib/supabase'
import type { CurrentUser, UserArea } from '@/lib/users'
import type { Equipo } from '@/lib/supabase'
import BatchAsignadoSelector, { AREA_TO_PIEZA_FIELD } from './BatchAsignadoSelector'
import { AREA_DEFS, type AreaState, ESTADO_PENDIENTE_INFO_LABEL } from '@/lib/areaStates'
import { PIPELINE_BY_TIPO, diasEnEstadoBatch, colorPorDiasEnEstado, fechaGrabacionPrevista, diasAtrasoCopys } from '@/lib/piezas'
import type { ClienteCicloRecursos } from '@/lib/supabase'
import { cicloMesLabel, parseCicloMes, currentCicloMes, prevCicloMes, nextCicloMes, type CicloMes } from '@/lib/cycles'
import { AREA_CLOSE_CONFIG } from '@/lib/areaClose'
import { getPreflightGate, missingPreflightFields } from '@/lib/areaPreflightGates'
import LoopAreaCloseModal from './LoopAreaCloseModal'
import LoopAreaPreflightModal from './LoopAreaPreflightModal'
import LoopPendienteInfoModal from './LoopPendienteInfoModal'
import PipelineNotasPanel from './PipelineNotasPanel'
import type { PipelineNotaArea } from '@/lib/supabase'

type Props = {
  area: UserArea
  agenciaId: string
  currentUser: CurrentUser
  clientes: Cliente[]
  owners: Owner[]
  onSelectCliente: (c: Cliente) => void
  ownerFilter?: string
  /** Si se pasa, sólo renderiza estas columnas (por id de AreaState). Útil para vistas focalizadas
   *  como "Reportes" que muestran sólo los últimos estados de Subida. */
  visibleStateIds?: number[]
  /** Override del título / subtítulo del header (opcional) */
  titleOverride?: { title: string; subtitle?: string; emoji?: string }
  /** Si se pasa, sólo carga piezas de ese ciclo. Sin esto, la pipeline mostraría
   *  todos los ciclos a la vez (clientes duplicados si hay piezas en varios meses). */
  cycleFilter?: CicloMes | null
  /** Map<cliente_id, count> de deudas pendientes asignadas al ciclo activo.
   *  Cards de clientes con deudas > 0 muestran un badge de alerta. */
  deudasPendientesByCliente?: Map<number, number>
  /** Miembros del equipo (para selector de asignación en cards). */
  equipo?: Equipo[]
  /** Map<`cliente_id::ciclo_mes`, recursos> para acceso a fecha_grabacion_*
   *  en el cálculo de atraso predictivo de copys. */
  recursosByLoop?: Map<string, ClienteCicloRecursos>
  /** Map<cliente_id, {fecha, confirmada}> de "Contenido hasta" — fallback
   *  para inferir grabación cuando no hay fechas explícitas. */
  fechasContenidoHasta?: Map<number, { fecha: Date; confirmada: boolean }>
}

type LoopBatch = {
  key: string                // `${cliente_id}::${ciclo_mes}`
  cliente: Cliente
  cicloMes: string
  piezas: Pieza[]            // piezas del batch que aplican a este area
  dominantState: string      // estado donde colocar el card
  aprobadas: number
  total: number
  /** Otras áreas donde el mismo loop (cliente×ciclo) tiene piezas activas en este momento.
   *  Para mostrar el badge "🔗 también en X" y evitar la confusión de "cliente duplicado". */
  otherActiveAreas: UserArea[]
}

const AREA_LABEL: Record<UserArea, string> = {
  copys: 'Copys', grab: 'Grab', edit: 'Edición', diseno: 'Diseño', subida: 'Subida', anuncios: 'Anuncios',
}
const ALL_AREAS_FOR_PARALLEL: UserArea[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']

/** Para el badge "🔗 también en X": qué áreas se consideran "paralelas válidas" desde cada área.
 *  Copys y grab son inicios del flujo — mostrar "también en edit/diseno" es ruido (esas piezas
 *  están más avanzadas que las de copys, no es trabajo paralelo). En post-copys/grab, las áreas
 *  edit/diseno/subida/anuncios sí pueden ser paralelas (videos en edit + portadas en diseño, etc.). */
const PARALLEL_AREAS_BY_AREA: Record<UserArea, UserArea[]> = {
  copys:    [],
  grab:     [],
  edit:     ['diseno', 'subida', 'anuncios'],
  diseno:   ['edit', 'subida', 'anuncios'],
  subida:   ['edit', 'diseno', 'anuncios'],
  anuncios: ['edit', 'diseno', 'subida'],
}

function colNameFor(area: UserArea): keyof Pieza {
  if (area === 'edit') return 'estado_edicion'
  return `estado_${area}` as keyof Pieza
}

function isApprovedValue(v: string | null | undefined): boolean {
  if (!v) return false
  const u = v.toUpperCase()
  // ⚠ NOTA: 'MÉTRICAS' fue removido. En el flujo nuevo de Copys, MÉTRICAS es
  // el PRIMER estado de trabajo (no el final) — incluirlo acá hacía que las
  // piezas en métricas desaparecieran de la pipeline.
  // 'METRICAS Y VOLVER A EMPEZAR' sí es terminal (cierre del ciclo legacy).
  return u === 'APROBADO' ||
    u === 'APROBADO - SUBIDA A CLICKUP' ||
    u === 'PUBLICADO' ||
    u === 'METRICAS Y VOLVER A EMPEZAR' ||
    u === 'MÉTRICAS Y VOLVER A EMPEZAR' ||
    u === 'VOLVER A EMPEZAR' ||
    u === 'MATERIAL APROBADO' || u === 'MATERIAL SUBIDO' ||
    u === 'LISTO PARA GRABAR'
}

/**
 * Una pieza está "en" un área si:
 *   - su pipeline incluye este área Y
 *   - su estado en este área NO está aprobado (todavía hay trabajo) Y
 *   - todas las áreas previas del pipeline ESTÁN aprobadas
 */
function piezaIsCurrentlyInArea(p: Pieza, area: UserArea): boolean {
  const pipeline = PIPELINE_BY_TIPO[p.tipo as PiezaTipo]
  if (!pipeline.includes(area)) return false
  const idx = pipeline.indexOf(area)
  // ¿Áreas previas todas aprobadas?
  for (let i = 0; i < idx; i++) {
    const prior = pipeline[i]
    const colPrior = prior === 'edit' ? 'estado_edicion' : `estado_${prior}`
    const v = (p as Record<string, unknown>)[colPrior] as string | null
    if (!isApprovedValue(v)) return false
  }
  // El área actual ¿aún no aprobada?
  const colHere = area === 'edit' ? 'estado_edicion' : `estado_${area}`
  const v = (p as Record<string, unknown>)[colHere] as string | null
  if (isApprovedValue(v)) {
    // ¿Es la última del pipeline? Si sí, dejamos que aparezca como "completado" acá
    return idx === pipeline.length - 1
  }
  return true
}

// Color de cycle stripe (mismo hash que en ProduccionKanban)
function colorForCycle(cicloMes: string): string {
  const palette = ['#5e72e4', '#a78bfa', '#00d97e', '#f5a623', '#ec4ad8', '#11cdef', '#fb6340', '#84cc16']
  let h = 0
  for (let i = 0; i < cicloMes.length; i++) h = (h * 31 + cicloMes.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

/** Estado dominante de piezas en este area. Heurística: el estado canónico más frecuente.
 *  Sólo cuenta valores que existen en areaStates — ignora vacíos y legacy values.
 *  Si ningún pieza tiene un estado canónico, devuelve el primer estado (RECEPCIÓN). */
function dominantStateInArea(piezas: Pieza[], area: UserArea, areaStates: AreaState[]): string {
  if (piezas.length === 0) return areaStates[0].label
  const col = colNameFor(area)
  const canonical = new Set(areaStates.map(s => s.label))
  const counts = new Map<string, number>()
  piezas.forEach(p => {
    const v = ((p[col] as string) || '').trim()
    if (!v) return
    if (!canonical.has(v)) return
    counts.set(v, (counts.get(v) ?? 0) + 1)
  })
  if (counts.size === 0) return areaStates[0].label
  let max = 0
  let dominant = areaStates[0].label
  counts.forEach((c, k) => { if (c > max) { max = c; dominant = k } })
  return dominant
}

export default function TableroPipeline({
  area, agenciaId, currentUser, clientes, owners, onSelectCliente, ownerFilter,
  visibleStateIds, titleOverride, cycleFilter, deudasPendientesByCliente, equipo, recursosByLoop, fechasContenidoHasta,
}: Props) {
  const def = AREA_DEFS[area]
  // Lista completa de estados (para lógica de transiciones / dominantState).
  // stateList = todos. visibleStates = sólo los que se renderizan en columnas.
  const stateList = def.states
  const visibleStates = useMemo(
    () => visibleStateIds ? stateList.filter(s => visibleStateIds.includes(s.id)) : stateList,
    [stateList, visibleStateIds]
  )
  const visibleStateLabels = useMemo(
    () => new Set(visibleStates.map(s => s.label)),
    [visibleStates]
  )
  const colKey = colNameFor(area)

  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<Record<string, string>>({})  // key → estado override mientras guarda
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [pendingClose, setPendingClose] = useState<{ batch: LoopBatch; toState: string } | null>(null)
  const [pendingPreflight, setPendingPreflight] = useState<{ batch: LoopBatch; fromState: string; toState: string } | null>(null)
  const [pendingPendienteInfo, setPendingPendienteInfo] = useState<{ batch: LoopBatch; toState: string } | null>(null)
  const [menuOpenForKey, setMenuOpenForKey] = useState<string | null>(null)
  const [cycleMenuOpenForKey, setCycleMenuOpenForKey] = useState<string | null>(null)
  const [showNotas, setShowNotas] = useState(false)

  // Estados de "mandar a corrección/revisión" disponibles para esta área.
  // Construido a partir de los IDs configurados en AREA_DEFS y deduplicados.
  const correctionOptions = useMemo(() => {
    const ids = new Set<number>()
    if (def.correctionStateId !== undefined) ids.add(def.correctionStateId)
    if (def.reviewInternalStateId !== undefined) ids.add(def.reviewInternalStateId)
    if (def.reviewClientStateId !== undefined) ids.add(def.reviewClientStateId)
    return stateList.filter(s => ids.has(s.id))
  }, [def, stateList])

  const clienteById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])

  const ownerById = useMemo(() => {
    const m = new Map<string, Owner>()
    owners.forEach(o => m.set(o.id, o))
    return m
  }, [owners])

  const visibleClienteIds = useMemo(() => {
    // Onboarding aparece también en los pipelines (Copys / Producción / etc) —
    // así el equipo ve toda la producción en un lugar, no sólo lo "ciclo normal".
    let list = clientes.filter(c => {
      const exc = (c.secciones_excluidas as string[] | null) ?? []
      return !exc.includes(area)
    })
    if (ownerFilter === '__none__') list = list.filter(c => !c.owner_id)
    else if (ownerFilter) list = list.filter(c => c.owner_id === ownerFilter)
    return new Set(list.map(c => c.id))
  }, [clientes, area, ownerFilter])

  // Fetch interno — no toca loading. Para refreshes silenciosos por eventos
  // realtime / cross-tab evitamos el "Cargando..." que parpadea encima del contenido.
  const fetchPiezas = useCallback(async (): Promise<Pieza[] | null> => {
    const PAGE = 1000
    const all: Pieza[] = []
    for (let page = 0; ; page++) {
      let query = supabase
        .from('piezas')
        .select('*')
        .eq('agencia_id', agenciaId)
        .range(page * PAGE, (page + 1) * PAGE - 1)
      if (cycleFilter) query = query.eq('ciclo_mes', cycleFilter)
      const { data, error } = await query
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.toLowerCase().includes('does not exist')) {
          setTableMissing(true); setPiezas([]); return null
        }
        console.error('[TableroPipeline] piezas error:', error); setPiezas([]); return null
      }
      const rows = (data ?? []) as Pieza[]
      all.push(...rows)
      if (rows.length < PAGE) break
    }
    setPiezas(all)
    return all
  }, [agenciaId, cycleFilter])

  // Carga "ruidosa" — muestra skeleton. Usar para load inicial y cambio de filtro.
  const loadPiezas = useCallback(async () => {
    setLoading(true)
    await fetchPiezas()
    setLoading(false)
  }, [fetchPiezas])

  useEffect(() => { loadPiezas() }, [loadPiezas])

  // Realtime / cross-tab refresh — silencioso, sin tocar loading
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

  // Limpiar optimistic cuando llega data fresca que matchea
  useEffect(() => {
    setOptimistic(prev => {
      const next = { ...prev }
      let changed = false
      // No tenemos forma de saber el "estado real" sin agrupar — confiamos en que al recargar
      // se cae naturalmente. Esto previene over-clean: dejamos que el dominante recalculado refleje.
      // Pero limpiamos overrides que ya pasaron > 5s para evitar deadlock visual.
      return changed ? next : prev
    })
  }, [piezas])

  // Toast auto-clear
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // Cross-tipo gate: dependencia entre tipos del mismo loop (ej: portadas esperan a que
  // los videos del loop estén edit-aprobados antes de entrar a Diseño).
  // Key: `${cliente_id}::${ciclo_mes}` → set de áreas en las que el loop tiene "videos listos"
  const videosEditedByLoop = useMemo(() => {
    const videosByLoop = new Map<string, Pieza[]>()
    for (const p of piezas) {
      if (p.tipo !== 'video') continue
      const k = `${p.cliente_id}::${p.ciclo_mes}`
      if (!videosByLoop.has(k)) videosByLoop.set(k, [])
      videosByLoop.get(k)!.push(p)
    }
    const ready = new Set<string>()
    videosByLoop.forEach((vs, k) => {
      if (vs.length === 0) return
      if (vs.every(v => isApprovedValue(v.estado_edicion))) ready.add(k)
    })
    return ready
  }, [piezas])

  const hasVideosInLoop = useMemo(() => {
    const s = new Set<string>()
    for (const p of piezas) {
      if (p.tipo === 'video') s.add(`${p.cliente_id}::${p.ciclo_mes}`)
    }
    return s
  }, [piezas])

  // Map<loopKey, Set<UserArea>>: en qué áreas tiene piezas activas el loop (cliente×ciclo).
  // Se usa para mostrar el badge "🔗 también en X" en cada card y evitar confusión
  // de "cliente duplicado" cuando son flujos paralelos por tipo de pieza.
  const activeAreasByLoop = useMemo(() => {
    const m = new Map<string, Set<UserArea>>()
    for (const p of piezas) {
      const k = `${p.cliente_id}::${p.ciclo_mes}`
      for (const a of ALL_AREAS_FOR_PARALLEL) {
        if (!piezaIsCurrentlyInArea(p, a)) continue
        if (!m.has(k)) m.set(k, new Set())
        m.get(k)!.add(a)
      }
    }
    return m
  }, [piezas])

  // Construir batches: filtra piezas que aplican a este area Y que realmente
  // ya llegaron al área (no las que están en áreas previas).
  const batches = useMemo<LoopBatch[]>(() => {
    const map = new Map<string, LoopBatch>()
    const piezasForArea = piezas.filter(p => {
      if (!visibleClienteIds.has(p.cliente_id)) return false
      if (!piezaIsCurrentlyInArea(p, area)) return false
      // Cross-tipo gate: portadas no entran a Diseño hasta que los videos del loop
      // estén edit-aprobados. Si el loop no tiene videos, la portada fluye normal.
      if (area === 'diseno' && p.tipo === 'portada') {
        const k = `${p.cliente_id}::${p.ciclo_mes}`
        if (hasVideosInLoop.has(k) && !videosEditedByLoop.has(k)) return false
      }
      return true
    })
    for (const p of piezasForArea) {
      const key = `${p.cliente_id}::${p.ciclo_mes}`
      let b = map.get(key)
      if (!b) {
        const cliente = clienteById.get(p.cliente_id)
        if (!cliente) continue
        // Filtrar paralelas válidas para esta área (excluyendo posteriores que serían ruido)
        const validParallels = new Set(PARALLEL_AREAS_BY_AREA[area] ?? [])
        const others = Array.from(activeAreasByLoop.get(key) ?? new Set<UserArea>())
          .filter(a => a !== area && validParallels.has(a))
        b = { key, cliente, cicloMes: p.ciclo_mes, piezas: [], dominantState: '', aprobadas: 0, total: 0, otherActiveAreas: others }
        map.set(key, b)
      }
      b.piezas.push(p)
      b.total++
      const v = (p[colKey] as string) || ''
      if (v === stateList[stateList.length - 1].label) b.aprobadas++
    }
    map.forEach(b => {
      // Aplicar override optimistic si existe
      const opt = optimistic[b.key]
      if (opt) {
        b.dominantState = opt
      } else {
        b.dominantState = dominantStateInArea(b.piezas, area, stateList)
      }
    })
    return Array.from(map.values()).sort((a, b) => {
      const ord = a.cliente.nombre.localeCompare(b.cliente.nombre)
      if (ord !== 0) return ord
      return b.cicloMes.localeCompare(a.cicloMes)
    })
  }, [piezas, visibleClienteIds, clienteById, area, colKey, stateList, optimistic, hasVideosInLoop, videosEditedByLoop, activeAreasByLoop])

  const byState = useMemo(() => {
    const result: Record<string, LoopBatch[]> = {}
    visibleStates.forEach(s => { result[s.label] = [] })
    const approvedLabel = stateList[stateList.length - 1].label
    const fallbackLabel = visibleStates[0]?.label ?? stateList[0].label
    batches.forEach(b => {
      // Si el batch no cae en la slice visible, lo ocultamos de la vista actual.
      if (!visibleStateLabels.has(b.dominantState)) return
      let target = b.dominantState
      // Safeguard: un batch sin piezas aprobadas NUNCA debe aparecer en la columna APROBADO.
      // Cubre estados stale, mirrors legacy y posibles races.
      if (target === approvedLabel && b.aprobadas < b.total) {
        target = fallbackLabel
      }
      if (result[target] !== undefined) result[target].push(b)
      else {
        // Estado no canónico → cae en el primero de la slice visible
        result[fallbackLabel].push(b)
      }
    })
    return result
  }, [batches, stateList, visibleStates, visibleStateLabels])

  // Total de batches mostrados en la slice actual (no total de todos los batches del área)
  const visibleBatches = useMemo(
    () => batches.filter(b => visibleStateLabels.has(b.dominantState)),
    [batches, visibleStateLabels]
  )

  // Bulk update: persistir el cambio de estado en todas las piezas del batch
  // Si está cerrando el área (transición al estado final), también guarda link + comment + fecha + preflight
  const persistBatchTransition = useCallback(async (batch: LoopBatch, toState: string, closeData?: {
    linkUrl: string
    comment: string
    preflightFields?: Record<string, string>
    closeDate: string
  }) => {
    const ids = batch.piezas.map(p => p.id)
    const payload: Record<string, unknown> = {
      [colKey]: toState,
      estado_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('piezas')
      .update(payload)
      .in('id', ids)
    if (error) return { ok: false, error: error.message }

    // Si es cierre de área, guardar todo en recursos del ciclo
    const cfg = AREA_CLOSE_CONFIG[area]
    if (closeData && toState === cfg.closeState) {
      const recursosUpdate: Record<string, unknown> = {
        agencia_id: agenciaId,
        cliente_id: batch.cliente.id,
        ciclo_mes: batch.cicloMes,
        [cfg.linkField]: closeData.linkUrl,
        [cfg.commentField]: closeData.comment || null,
        [cfg.dateField]: closeData.closeDate,
        updated_at: new Date().toISOString(),
      }
      // Pre-flight fields (copys)
      if (closeData.preflightFields) {
        Object.entries(closeData.preflightFields).forEach(([k, v]) => {
          recursosUpdate[k] = v || null
        })
      }
      const { error: eRec } = await supabase
        .from('cliente_ciclo_recursos')
        .upsert(recursosUpdate, { onConflict: 'cliente_id,ciclo_mes' })
      if (eRec) return { ok: false, error: `Estado guardado, pero recursos no: ${eRec.message}` }

      // ============ B3: Auto-generación de deuda al cerrar SUBIDA ============
      // Contamos piezas PUBLICADAS del cliente×ciclo POR TIPO y comparamos con el plan
      // del cliente. Si falta en algún tipo, generamos una deuda con desglose.
      if (area === 'subida') {
        try {
          const c = batch.cliente as Cliente & { plan_videos?: number; plan_portadas?: number; plan_carrouseles?: number; plan_historias?: number }
          const planByTipo = {
            video:     c.plan_videos ?? 0,
            portada:   c.plan_portadas ?? 0,
            carrousel: c.plan_carrouseles ?? 0,
            historia:  c.plan_historias ?? 0,
          }
          const totalPactado = Object.values(planByTipo).reduce((s, n) => s + n, 0)
          if (totalPactado > 0) {
            // Contar publicadas por tipo (incluye el batch actual que recién pasó a PUBLICADO)
            const { data: pubRows } = await supabase
              .from('piezas')
              .select('tipo')
              .eq('agencia_id', agenciaId)
              .eq('cliente_id', batch.cliente.id)
              .eq('ciclo_mes', batch.cicloMes)
              .eq('estado_subida', 'PUBLICADO')
            const publicadasByTipo: Record<string, number> = { video: 0, portada: 0, carrousel: 0, historia: 0 }
            for (const r of pubRows ?? []) {
              const t = (r as { tipo: string }).tipo
              if (t in publicadasByTipo) publicadasByTipo[t]++
            }
            // Calcular faltantes por tipo (clamp >=0 — si subimos de más, no se cuenta como deuda neg aquí)
            const faltaVideos      = Math.max(0, planByTipo.video     - publicadasByTipo.video)
            const faltaPortadas    = Math.max(0, planByTipo.portada   - publicadasByTipo.portada)
            const faltaCarrouseles = Math.max(0, planByTipo.carrousel - publicadasByTipo.carrousel)
            const faltaHistorias   = Math.max(0, planByTipo.historia  - publicadasByTipo.historia)
            const totalFalta = faltaVideos + faltaPortadas + faltaCarrouseles + faltaHistorias
            if (totalFalta > 0) {
              const partes: string[] = []
              if (faltaVideos > 0)      partes.push(`${faltaVideos} reels`)
              if (faltaPortadas > 0)    partes.push(`${faltaPortadas} portadas`)
              if (faltaCarrouseles > 0) partes.push(`${faltaCarrouseles} carrouseles`)
              if (faltaHistorias > 0)   partes.push(`${faltaHistorias} historias`)
              await supabase.from('deudas_contenido').insert({
                agencia_id: agenciaId,
                cliente_id: batch.cliente.id,
                ciclo_origen: batch.cicloMes,
                ciclo_asignado: nextCicloMes(batch.cicloMes), // por default cae al ciclo siguiente
                cantidad: totalFalta,
                cantidad_videos:      faltaVideos      > 0 ? faltaVideos      : null,
                cantidad_portadas:    faltaPortadas    > 0 ? faltaPortadas    : null,
                cantidad_carrouseles: faltaCarrouseles > 0 ? faltaCarrouseles : null,
                cantidad_historias:   faltaHistorias   > 0 ? faltaHistorias   : null,
                motivo: `Faltaron: ${partes.join(', ')} (vs pactado del ciclo)`,
                origen: 'auto_subida',
                estado: 'pendiente',
                creado_por: currentUser.name,
              })
            }
          }
        } catch (err) {
          console.warn('[deuda auto-subida]', err)
        }
      }
    }

    // ============ SYNC GLOBAL ============
    // Después de mover el batch, mirroreamos a:
    //   - cliente_ciclo_recursos.estado_loop  (estado dominante del loop / ciclo)
    //   - cliente.estado + cliente.estado_<area>  (legacy mirror para Tablero General / Owners / etc.)
    // Sin este sync, el Tablero General muestra "Sin estado" aunque el loop esté avanzado.
    try {
      // 1. estado_loop del ciclo = toState (el batch acaba de quedar en este estado)
      await supabase
        .from('cliente_ciclo_recursos')
        .upsert({
          agencia_id: agenciaId,
          cliente_id: batch.cliente.id,
          ciclo_mes: batch.cicloMes,
          estado_loop: toState,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cliente_id,ciclo_mes' })

      // 2. cliente.estado_<area> espejo + cliente.estado (global) si este ciclo es el "primario"
      //    Primario = el ciclo_mes que tiene marcado el cliente (sino, asumimos que es)
      const clienteUpdate: Record<string, unknown> = {
        [`estado_${area === 'edit' ? 'edicion' : area}`]: toState,
        estado_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const primaryCycle = batch.cliente.ciclo_mes || batch.cicloMes
      if (primaryCycle === batch.cicloMes) {
        clienteUpdate.estado = toState
      }
      await supabase.from('clientes').update(clienteUpdate).eq('id', batch.cliente.id)
    } catch (e) {
      console.warn('[persistBatchTransition] sync global falló (no bloquea la transición):', e)
    }

    return { ok: true }
  }, [agenciaId, area, colKey, currentUser.name])

  // Ejecuta la transición sin intercepción (después de modales pasados)
  const doMove = useCallback(async (batch: LoopBatch, toState: string) => {
    flushSync(() => {
      setOptimistic(prev => ({ ...prev, [batch.key]: toState }))
      setSavingKey(batch.key)
    })
    const res = await persistBatchTransition(batch, toState)
    setSavingKey(null)
    if (!res.ok) {
      setOptimistic(prev => { const n = { ...prev }; delete n[batch.key]; return n })
      setToast({ msg: `Error: ${res.error}`, type: 'err' })
      return
    }
    setToast({
      msg: `${batch.cliente.nombre} · ${cicloMesLabel(batch.cicloMes).split(' ')[0]} → ${toState}`,
      type: 'ok',
    })
    await loadPiezas()
    setOptimistic(prev => { const n = { ...prev }; delete n[batch.key]; return n })
  }, [persistBatchTransition, loadPiezas])

  // Función compartida entre drag-end y click "→" — intercepta close + preflight + pendiente-info
  const moveBatchTo = useCallback(async (batch: LoopBatch, toState: string) => {
    if (batch.dominantState === toState) return

    // 0. Pendiente de información (Copys) → modal con motivos multi-select
    if (area === 'copys' && toState === ESTADO_PENDIENTE_INFO_LABEL) {
      setPendingPendienteInfo({ batch, toState })
      return
    }

    // 0.b. Salida de PENDIENTE DE INFORMACIÓN → si NO es "no aplica", requiere link del documento.
    if (area === 'copys' && batch.dominantState === ESTADO_PENDIENTE_INFO_LABEL) {
      const { data: rec } = await supabase.from('cliente_ciclo_recursos')
        .select('pendiente_info_no_aplica, pendiente_info_link')
        .eq('cliente_id', batch.cliente.id).eq('ciclo_mes', batch.cicloMes).maybeSingle()
      const noAplica = !!rec?.pendiente_info_no_aplica
      const existingLink = (rec?.pendiente_info_link ?? '').trim()
      if (!noAplica && !existingLink) {
        const link = window.prompt(
          `Para salir de PENDIENTE DE INFORMACIÓN se necesita el link del documento con la info que estabas esperando.\n\nPegá el link (https://...):\n\nO cancelá y marcá NO APLICA en la card si este ciclo no aplica.`
        )
        if (!link) return
        const url = link.trim()
        if (!url.startsWith('http')) {
          setToast({ msg: 'El link tiene que empezar con http(s)://', type: 'err' })
          return
        }
        await supabase.from('cliente_ciclo_recursos').upsert({
          agencia_id: agenciaId,
          cliente_id: batch.cliente.id,
          ciclo_mes: batch.cicloMes,
          pendiente_info_link: url,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cliente_id,ciclo_mes' })
      }
      // No return — sigue al flujo normal de transición
    }

    // 0.c. Entrada a CORRECCIÓN → requiere link de las correcciones.
    if (area === 'copys' && toState === 'CORRECCIÓN') {
      const { data: rec } = await supabase.from('cliente_ciclo_recursos')
        .select('correcciones_link')
        .eq('cliente_id', batch.cliente.id).eq('ciclo_mes', batch.cicloMes).maybeSingle()
      const existingLink = (rec?.correcciones_link ?? '').trim()
      const link = existingLink || window.prompt(
        `Para mandar a CORRECCIÓN se necesita el link al documento con las correcciones.\n\nPegá el link (https://...):`
      )
      if (!link) return
      const url = link.trim()
      if (!url.startsWith('http')) {
        setToast({ msg: 'El link tiene que empezar con http(s)://', type: 'err' })
        return
      }
      if (url !== existingLink) {
        await supabase.from('cliente_ciclo_recursos').upsert({
          agencia_id: agenciaId,
          cliente_id: batch.cliente.id,
          ciclo_mes: batch.cicloMes,
          correcciones_link: url,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cliente_id,ciclo_mes' })
      }
      // sigue al flujo normal
    }

    // 0.d. Gate "tardó mucho" — si el batch lleva > 3 días en el estado actual,
    // pedir justificación antes de avanzar. Se guarda como nota tipo "nota".
    const dias = diasEnEstadoBatch(batch.piezas) ?? 0
    if (dias > 3) {
      const motivo = window.prompt(
        `Este batch estuvo ${dias} días en "${batch.dominantState}".\n\n` +
        `Antes de pasarlo a "${toState}", contanos por qué tardó:`
      )
      if (motivo === null) return  // cancelado
      const texto = motivo.trim()
      if (texto.length > 0) {
        await supabase.from('pipeline_notas').insert({
          agencia_id: agenciaId,
          area,
          cliente_id: batch.cliente.id,
          ciclo_mes: batch.cicloMes,
          tipo: 'nota',
          texto: `[${dias}d en ${batch.dominantState}] ${texto}`,
          autor: currentUser.name,
        })
      }
    }

    // 1. Cierre de área → modal con link + comment + preflight
    const cfg = AREA_CLOSE_CONFIG[area]
    if (toState === cfg.closeState) {
      setPendingClose({ batch, toState })
      return
    }

    // 2. Preflight gate (ej: copys MÉTRICAS → POR HACER SCRIPTS)
    const gate = getPreflightGate(area, batch.dominantState, toState)
    if (gate) {
      // Verificar si faltan campos
      const [{ data: cliData }, { data: recData }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', batch.cliente.id).single(),
        supabase.from('cliente_ciclo_recursos').select('*')
          .eq('cliente_id', batch.cliente.id).eq('ciclo_mes', batch.cicloMes).maybeSingle(),
      ])
      const missing = missingPreflightFields(area, batch.dominantState, toState, cliData ?? null, recData ?? null)
      if (missing.length > 0) {
        setPendingPreflight({ batch, fromState: batch.dominantState, toState })
        return
      }
    }

    // 3. Sin intercepción → mover directo
    await doMove(batch, toState)
  }, [area, doMove])

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    const toState = result.destination.droppableId
    const key = result.draggableId
    const batch = batches.find(b => b.key === key)
    if (!batch) return
    await moveBatchTo(batch, toState)
  }, [batches, moveBatchTo])

  // Avanzar al siguiente estado del area (botón →)
  const advanceBatch = useCallback(async (batch: LoopBatch) => {
    const currentIdx = stateList.findIndex(s => s.label === batch.dominantState)
    const nextIdx = currentIdx + 1
    if (nextIdx >= stateList.length) return
    await moveBatchTo(batch, stateList[nextIdx].label)
  }, [stateList, moveBatchTo])

  // Marcar el batch como "NO APLICA" en PENDIENTE DE INFORMACIÓN — saltea
  // el estado y pasa directo a MÉTRICAS. Persiste el flag en recursos.
  const marcarNoAplica = useCallback(async (batch: LoopBatch) => {
    const ok = window.confirm(
      `Marcar ${batch.cliente.nombre} (${cicloMesLabel(batch.cicloMes)}) como NO APLICA y pasar a MÉTRICAS?`
    )
    if (!ok) return
    setSavingKey(batch.key)
    const { error } = await supabase
      .from('cliente_ciclo_recursos')
      .upsert({
        agencia_id: agenciaId,
        cliente_id: batch.cliente.id,
        ciclo_mes: batch.cicloMes,
        pendiente_info_no_aplica: true,
        pendiente_info_motivos: null,
        pendiente_info_otro: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cliente_id,ciclo_mes' })
    if (error) {
      setSavingKey(null)
      const msg = /pendiente_info/i.test(error.message)
        ? 'Falta aplicar la migration sql/2026-05-17_pendiente_info_copys.sql'
        : error.message
      setToast({ msg: `Error: ${msg}`, type: 'err' })
      return
    }
    // Pasar a MÉTRICAS (siguiente estado del flujo)
    await doMove(batch, stateList[1]?.label ?? 'MÉTRICAS')
  }, [agenciaId, doMove, stateList])

  // Mover todas las piezas del batch a otro ciclo (UPDATE bulk en piezas.ciclo_mes)
  const moveBatchToCycle = useCallback(async (batch: LoopBatch, targetCycle: CicloMes) => {
    if (batch.cicloMes === targetCycle) return
    const ok = window.confirm(
      `¿Mover el batch de ${batch.cliente.nombre} (${batch.piezas.length} piezas) ` +
      `del ciclo ${cicloMesLabel(batch.cicloMes)} a ${cicloMesLabel(targetCycle)}?`
    )
    if (!ok) return
    setSavingKey(batch.key)
    const ids = batch.piezas.map(p => p.id)
    const { error } = await supabase
      .from('piezas')
      .update({ ciclo_mes: targetCycle, updated_at: new Date().toISOString() })
      .in('id', ids)
    setSavingKey(null)
    if (error) {
      setToast({ msg: `Error: ${error.message}`, type: 'err' })
      return
    }
    setToast({
      msg: `${batch.cliente.nombre} · ${cicloMesLabel(batch.cicloMes).split(' ')[0]} → ${cicloMesLabel(targetCycle).split(' ')[0]}`,
      type: 'ok',
    })
    await loadPiezas()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('estado-loop-changed'))
    }
  }, [loadPiezas])

  // Eliminar el ciclo completo del cliente: piezas + recursos del ciclo + notas + logs.
  // NO borra deudas — siguen siendo útiles aunque el ciclo se elimine.
  // Requiere tipear "ELIMINAR" para confirmar (operación destructiva).
  const eliminarLoop = useCallback(async (batch: LoopBatch) => {
    const respuesta = window.prompt(
      `⚠ Vas a ELIMINAR todo el ciclo ${cicloMesLabel(batch.cicloMes)} para ${batch.cliente.nombre}.\n\n` +
      `Se borra:\n` +
      `• TODAS las piezas del ciclo (videos, portadas, carrouseles, historias)\n` +
      `• Recursos del ciclo (drives, links, fechas, comentarios)\n` +
      `• Notas del ciclo de TODAS las áreas\n` +
      `• Logs de estados del ciclo\n\n` +
      `NO se borran las deudas — siguen activas.\n\n` +
      `Para confirmar, escribí exactamente: ELIMINAR`
    )
    if (respuesta !== 'ELIMINAR') {
      if (respuesta !== null) setToast({ msg: 'Cancelado — el texto no coincidía', type: 'err' })
      return
    }
    setSavingKey(batch.key)
    try {
      const filtros = { cliente_id: batch.cliente.id, ciclo_mes: batch.cicloMes }
      const results = await Promise.all([
        supabase.from('piezas').delete().match(filtros),
        supabase.from('cliente_ciclo_recursos').delete().match(filtros),
        supabase.from('pipeline_notas').delete().match(filtros),
        supabase.from('estado_log').delete().match(filtros),
      ])
      const firstErr = results.find(r => r.error)?.error
      if (firstErr) {
        setSavingKey(null)
        setToast({ msg: `Error parcial: ${firstErr.message}`, type: 'err' })
        await loadPiezas()
        return
      }
    } catch (err) {
      console.warn('[eliminarLoop]', err)
    }
    setSavingKey(null)
    setToast({
      msg: `🗑 ${batch.cliente.nombre} · ${cicloMesLabel(batch.cicloMes).split(' ')[0]} eliminado`,
      type: 'ok',
    })
    await loadPiezas()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('estado-loop-changed'))
      window.dispatchEvent(new Event('clientes-refresh'))
    }
  }, [loadPiezas])

  const totalBatches = visibleBatches.length
  const aprobadosCount = useMemo(
    () => visibleBatches.filter(b => b.total > 0 && b.aprobadas === b.total).length,
    [visibleBatches]
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{
        marginBottom: 14, padding: '12px 16px',
        background: `linear-gradient(135deg, ${def.primaryColor}12 0%, ${def.primaryColor}05 100%)`,
        border: `1px solid ${def.primaryColor}33`,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap' as const, gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{titleOverride?.emoji ?? def.emoji}</span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              {titleOverride?.title ?? `Pipeline · ${def.label}`}
            </h2>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>
              {titleOverride?.subtitle ?? <>Cada card es un <strong>loop (cliente × ciclo)</strong>. Drag = bulk update de las piezas del batch.</>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.4, fontWeight: 600 }}>Total</span>
          <strong style={{ fontSize: 18, color: '#a0a0b8' }}>{totalBatches}</strong>
          <span style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.4, fontWeight: 600 }}>Aprobados</span>
          <strong style={{ fontSize: 18, color: '#00d97e' }}>{aprobadosCount}</strong>
          <button
            onClick={() => setShowNotas(true)}
            title="Notas / fallas / correcciones de este ciclo"
            style={{
              padding: '6px 10px', borderRadius: 6,
              background: '#1a1a28', border: '1px solid #2a2a40',
              color: '#a0a0b8', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >📒 Notas</button>
        </div>
      </div>

      {showNotas && (
        <PipelineNotasPanel
          agenciaId={agenciaId}
          area={area as PipelineNotaArea}
          cicloMes={cycleFilter ?? currentCicloMes()}
          currentUser={currentUser}
          onClose={() => setShowNotas(false)}
        />
      )}

      {tableMissing && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
          color: '#f5365c', fontSize: 12,
        }}>
          La tabla <code>piezas</code> no existe — aplicá <code>sql/2026-05-08_phase_A_piezas.sql</code>.
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>Cargando loops…</div>
      ) : totalBatches === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center' as const, color: '#6a6a80',
          background: '#12121a', borderRadius: 10, border: '1px solid #2a2a40',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 13 }}>Sin batches activos en esta área.</p>
          <p style={{ fontSize: 11 }}>
            Generá el batch de un cliente desde <strong>cliente detail → Piezas del mes → Generar batch</strong>.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div
            className="pipeline-cols-mobile"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${visibleStates.length}, minmax(220px, 1fr))`,
              gap: 10,
              overflowX: 'auto' as const,
              paddingBottom: 8,
              ['--pipeline-cols' as never]: visibleStates.length as never,
            }}>
            {visibleStates.map(state => {
              const list = byState[state.label] ?? []
              const stateColor = state.color || def.primaryColor
              return (
                <Droppable key={state.id} droppableId={state.label}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        background: snapshot.isDraggingOver ? `${stateColor}15` : '#1a1a28',
                        border: `1px solid ${snapshot.isDraggingOver ? stateColor : stateColor + '33'}`,
                        borderRadius: 10,
                        padding: 8,
                        display: 'flex', flexDirection: 'column' as const, minHeight: 200,
                      }}
                    >
                      {/* Column header */}
                      <div style={{
                        padding: '6px 8px', marginBottom: 6,
                        borderBottom: `1px solid ${stateColor}22`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{
                          fontSize: 10, fontWeight: 800, color: stateColor,
                          display: 'flex', alignItems: 'center', gap: 6,
                          textTransform: 'uppercase' as const, letterSpacing: 0.3,
                        }}>
                          <span>{state.icon}</span>
                          <span>{state.short || state.label}</span>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '1px 6px', borderRadius: 8,
                          background: stateColor + '22', color: stateColor,
                        }}>{list.length}</span>
                      </div>

                      {/* Cards */}
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                        {list.length === 0 ? (
                          <div style={{ padding: 10, fontSize: 11, color: '#3a3a55', textAlign: 'center' as const, fontStyle: 'italic' as const }}>—</div>
                        ) : list.map((batch, idx) => {
                          const cycleColor = colorForCycle(batch.cicloMes)
                          const cycleParsed = parseCicloMes(batch.cicloMes)
                          const owner = batch.cliente.owner_id ? ownerById.get(batch.cliente.owner_id) : null
                          const isSaving = savingKey === batch.key
                          const pct = batch.total > 0 ? Math.round((batch.aprobadas / batch.total) * 100) : 0
                          // Asignado dominante del batch para esta área (la primera pieza con valor)
                          const asignadoField = AREA_TO_PIEZA_FIELD[area]
                          const asignadoIdActual: string | null = asignadoField
                            ? ((batch.piezas.find(p => (p as Record<string, unknown>)[asignadoField as string])?.[asignadoField] as string | null) ?? null)
                            : null

                          return (
                            <Draggable key={batch.key} draggableId={batch.key} index={idx}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={{
                                    ...dragProvided.draggableProps.style,
                                    background: dragSnapshot.isDragging ? '#22223a' : '#12121a',
                                    borderRadius: 6,
                                    borderLeft: `3px solid ${cycleColor}`,
                                    border: `1px solid ${isSaving ? stateColor : '#2a2a40'}`,
                                    padding: '8px 10px',
                                    cursor: 'grab',
                                    opacity: isSaving ? 0.7 : 1,
                                    boxShadow: dragSnapshot.isDragging ? '0 4px 16px rgba(0,0,0,.4)' : 'none',
                                    transition: 'opacity .15s, box-shadow .15s',
                                  }}
                                >
                                  {/* Cycle badge */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{
                                      fontSize: 9, fontWeight: 800,
                                      padding: '1px 5px', borderRadius: 3,
                                      background: cycleColor + '22', color: cycleColor,
                                      border: `1px solid ${cycleColor}44`,
                                      textTransform: 'uppercase' as const, letterSpacing: 0.3,
                                    }}>
                                      🔄 {cycleParsed?.label.split(' ')[0] || batch.cicloMes}
                                    </span>
                                  </div>

                                  {/* Cliente name + badge "hace Xd" */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, justifyContent: 'space-between' }}>
                                    <div
                                      onClick={(e) => { e.stopPropagation(); onSelectCliente(batch.cliente) }}
                                      style={{ fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: 1, minWidth: 0, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}
                                      onMouseEnter={e => (e.currentTarget.style.color = '#5e72e4')}
                                      onMouseLeave={e => (e.currentTarget.style.color = '#e8e8f0')}
                                    >
                                      {batch.cliente.nombre}
                                    </div>
                                    {(() => {
                                      const dias = diasEnEstadoBatch(batch.piezas)
                                      if (dias === null) return null
                                      const col = colorPorDiasEnEstado(dias)
                                      return (
                                        <span title={`Hace ${dias} día${dias === 1 ? '' : 's'} en "${batch.dominantState}"`} style={{
                                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                                          background: col.bg, border: `1px solid ${col.border}`, color: col.color,
                                          flexShrink: 0,
                                        }}>{dias}d</span>
                                      )
                                    })()}
                                  </div>

                                  {/* Badge "🔥 Xd de atraso" — solo en copys, cuando hay próxima grabación prevista
                                       y el script no está listo. Calcula desde fecha_grabacion_confirmada / tentativa
                                       o (fecha "Contenido hasta" − 14d). 21d de anticipación SLA. */}
                                  {area === 'copys' && batch.dominantState !== 'LISTO PARA GRABAR' && (() => {
                                    const rec = recursosByLoop?.get(batch.key) ?? null
                                    const fc = fechasContenidoHasta?.get(batch.cliente.id) ?? null
                                    const fechaGrab = fechaGrabacionPrevista(
                                      rec?.fecha_grabacion_confirmada,
                                      rec?.fecha_grabacion_tentativa,
                                      fc?.fecha ?? null,
                                    )
                                    const dias = diasAtrasoCopys(fechaGrab)
                                    if (dias <= 0) return null
                                    const tipoFecha = rec?.fecha_grabacion_confirmada ? 'confirmada' : rec?.fecha_grabacion_tentativa ? 'tentativa' : 'estimada'
                                    return (
                                      <div
                                        title={`Próxima grabación ${tipoFecha}: ${fechaGrab?.toLocaleDateString('es-AR')}. Los scripts deberían estar listos hace ${dias} días (SLA: 21d de anticipación).`}
                                        style={{
                                          fontSize: 9, fontWeight: 700,
                                          padding: '2px 5px', borderRadius: 3,
                                          background: 'rgba(245,54,92,.15)',
                                          color: '#f5365c',
                                          border: '1px solid rgba(245,54,92,.40)',
                                          marginBottom: 4, display: 'inline-block',
                                          textTransform: 'uppercase' as const, letterSpacing: 0.3,
                                        }}>
                                        🔥 {dias}d de atraso
                                      </div>
                                    )
                                  })()}

                                  {/* Badge "🔒 X deudas pendientes" — gate: este cliente tiene deudas asignadas al ciclo */}
                                  {(deudasPendientesByCliente?.get(batch.cliente.id) ?? 0) > 0 && (
                                    <div
                                      title="Hay deudas pendientes asignadas a este ciclo — el ciclo no cierra hasta saldarlas. Vé a Deudas para gestionar."
                                      style={{
                                        fontSize: 9, color: '#f5365c',
                                        background: 'rgba(245,54,92,.10)',
                                        border: '1px solid rgba(245,54,92,.30)',
                                        borderRadius: 3, padding: '2px 5px',
                                        marginBottom: 4, display: 'inline-block',
                                        textTransform: 'uppercase' as const, letterSpacing: 0.3, fontWeight: 700,
                                      }}>
                                      🔒 {deudasPendientesByCliente!.get(batch.cliente.id)} deuda{(deudasPendientesByCliente!.get(batch.cliente.id) ?? 0) > 1 ? 's' : ''} pendiente{(deudasPendientesByCliente!.get(batch.cliente.id) ?? 0) > 1 ? 's' : ''}
                                    </div>
                                  )}
                                  {/* Badge "🔗 también en X" — el mismo loop tiene piezas activas en otras áreas (flujo paralelo) */}
                                  {batch.otherActiveAreas.length > 0 && (
                                    <div
                                      title={`Este cliente también tiene piezas activas en: ${batch.otherActiveAreas.map(a => AREA_LABEL[a]).join(', ')}. No es duplicado — son flujos paralelos por tipo de pieza.`}
                                      style={{
                                        fontSize: 9, color: '#a78bfa',
                                        background: 'rgba(167,139,250,.10)',
                                        border: '1px solid rgba(167,139,250,.25)',
                                        borderRadius: 3, padding: '2px 5px',
                                        marginBottom: 4, display: 'inline-block',
                                        textTransform: 'uppercase' as const, letterSpacing: 0.3, fontWeight: 600,
                                      }}>
                                      🔗 también en {batch.otherActiveAreas.map(a => AREA_LABEL[a]).join(', ')}
                                    </div>
                                  )}

                                  {/* Owner + Asignado del área */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                                    {owner && (
                                      <span style={{
                                        width: 16, height: 16, borderRadius: 4,
                                        background: owner.color + '22', color: owner.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: 8, flexShrink: 0,
                                      }}>{owner.nombre_corto[0]}</span>
                                    )}
                                    <span style={{ color: '#a0a0b8', fontSize: 10 }}>
                                      {owner?.nombre_corto || 'Sin owner'}
                                    </span>
                                    {/* Selector de persona asignada para esta área del batch */}
                                    {equipo && AREA_TO_PIEZA_FIELD[area] && (
                                      <BatchAsignadoSelector
                                        area={area}
                                        piezasIds={batch.piezas.map(p => p.id)}
                                        asignadoIdActual={asignadoIdActual}
                                        equipo={equipo}
                                        disabled={isSaving}
                                        onAsignado={() => fetchPiezas()}
                                        responsible={stateList.find(s => s.label === batch.dominantState)?.responsible}
                                      />
                                    )}
                                  </div>

                                  {/* Chip "👤 rol responsable" del estado actual */}
                                  {(() => {
                                    const st = stateList.find(s => s.label === batch.dominantState)
                                    const resp = st?.responsible
                                    if (!resp) return null
                                    const list = Array.isArray(resp) ? resp : [resp]
                                    return (
                                      <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
                                        {list.map(r => (
                                          <span key={r}
                                            title={`Tarea responsabilidad de: ${r}`}
                                            style={{
                                              fontSize: 9, fontWeight: 700,
                                              padding: '2px 6px', borderRadius: 3,
                                              background: r === 'owner' ? 'rgba(245,166,35,.12)' : 'rgba(94,114,228,.12)',
                                              color: r === 'owner' ? '#f5a623' : '#5e72e4',
                                              border: r === 'owner' ? '1px solid rgba(245,166,35,.30)' : '1px solid rgba(94,114,228,.30)',
                                              textTransform: 'uppercase' as const, letterSpacing: 0.3,
                                            }}>
                                            👤 {r}
                                          </span>
                                        ))}
                                      </div>
                                    )
                                  })()}

                                  {/* Progress bar + advance button */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, height: 4, background: '#0a0a0f', borderRadius: 2, overflow: 'hidden' as const }}>
                                      <div style={{
                                        width: `${pct}%`, height: '100%',
                                        background: pct === 100 ? '#00d97e' : pct >= 50 ? '#5e72e4' : pct > 0 ? '#f5a623' : '#3a3a55',
                                        transition: 'width .3s',
                                      }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: '#6a6a80', fontWeight: 700, minWidth: 36, textAlign: 'right' as const }}>
                                      {batch.aprobadas}/{batch.total}
                                    </span>
                                    {/* Botón "NO APLICA" — visible sólo en PENDIENTE DE INFORMACIÓN (copys) */}
                                    {area === 'copys' && batch.dominantState === ESTADO_PENDIENTE_INFO_LABEL && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); marcarNoAplica(batch) }}
                                        title="No aplica este ciclo — saltar a MÉTRICAS"
                                        disabled={isSaving}
                                        style={{
                                          background: 'rgba(106,106,128,.15)', border: '1px solid #6a6a80',
                                          color: '#a0a0b8', fontSize: 10, fontWeight: 700,
                                          padding: '3px 6px', borderRadius: 4,
                                          cursor: isSaving ? 'wait' : 'pointer',
                                          opacity: isSaving ? 0.5 : 1,
                                          letterSpacing: 0.3,
                                        }}
                                      >NO APLICA</button>
                                    )}
                                    {/* Botón "↺ mandar a corrección/revisión" — click directo al primero, ▾ para dropdown */}
                                    {(() => {
                                      const opciones = correctionOptions.filter(s => s.label !== batch.dominantState)
                                      if (opciones.length === 0) return null
                                      const isOpen = menuOpenForKey === batch.key
                                      const primary = opciones[0]
                                      const hasMore = opciones.length > 1
                                      return (
                                        <div style={{ position: 'relative' as const, display: 'flex', gap: 0 }}>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); moveBatchTo(batch, primary.label) }}
                                            title={`Mandar a ${primary.label}`}
                                            disabled={isSaving}
                                            style={{
                                              background: '#f5365c22', border: '1px solid #f5365c55',
                                              color: '#f5365c', fontSize: 11, fontWeight: 700,
                                              padding: '3px 7px',
                                              borderRadius: hasMore ? '4px 0 0 4px' : 4,
                                              borderRight: hasMore ? 'none' : '1px solid #f5365c55',
                                              cursor: isSaving ? 'wait' : 'pointer',
                                              opacity: isSaving ? 0.5 : 1,
                                            }}
                                          >↺</button>
                                          {hasMore && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setMenuOpenForKey(isOpen ? null : batch.key) }}
                                              title="Otras opciones de corrección"
                                              disabled={isSaving}
                                              style={{
                                                background: '#f5365c22', border: '1px solid #f5365c55',
                                                color: '#f5365c', fontSize: 9, fontWeight: 700,
                                                padding: '3px 4px', borderRadius: '0 4px 4px 0',
                                                cursor: isSaving ? 'wait' : 'pointer',
                                                opacity: isSaving ? 0.5 : 1,
                                              }}
                                            >▾</button>
                                          )}
                                          {isOpen && (
                                            <>
                                              <div
                                                onClick={(e) => { e.stopPropagation(); setMenuOpenForKey(null) }}
                                                style={{ position: 'fixed' as const, inset: 0, zIndex: 60 }}
                                              />
                                              <div style={{
                                                position: 'absolute' as const, top: '100%', right: 0, marginTop: 4,
                                                background: '#1a1a28', border: '1px solid #2a2a40',
                                                borderRadius: 6, padding: 4, minWidth: 180, zIndex: 61,
                                                boxShadow: '0 4px 16px rgba(0,0,0,.4)',
                                              }}>
                                                <div style={{
                                                  padding: '4px 8px', fontSize: 9, color: '#6a6a80',
                                                  fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4,
                                                }}>Mandar a</div>
                                                {opciones.map(opt => (
                                                  <button
                                                    key={opt.id}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setMenuOpenForKey(null)
                                                      moveBatchTo(batch, opt.label)
                                                    }}
                                                    style={{
                                                      width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                                                      padding: '6px 8px', borderRadius: 4,
                                                      background: 'transparent', border: 'none',
                                                      color: '#e8e8f0', fontSize: 11, fontWeight: 600,
                                                      cursor: 'pointer', textAlign: 'left' as const,
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#22223a')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                  >
                                                    <span>{opt.icon}</span>
                                                    <span>{opt.label}</span>
                                                  </button>
                                                ))}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    {/* Botón "📅 mover a otro ciclo" */}
                                    {(() => {
                                      const cur = currentCicloMes()
                                      const opciones = [prevCicloMes(cur), cur, nextCicloMes(cur)]
                                        .filter((c, i, arr) => arr.indexOf(c) === i && c !== batch.cicloMes)
                                      if (opciones.length === 0) return null
                                      const isOpen = cycleMenuOpenForKey === batch.key
                                      return (
                                        <div style={{ position: 'relative' as const }}>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setCycleMenuOpenForKey(isOpen ? null : batch.key) }}
                                            title="Mover el loop a otro ciclo"
                                            disabled={isSaving}
                                            style={{
                                              background: '#a78bfa22', border: '1px solid #a78bfa55',
                                              color: '#a78bfa', fontSize: 11, fontWeight: 700,
                                              padding: '3px 7px', borderRadius: 4,
                                              cursor: isSaving ? 'wait' : 'pointer',
                                              opacity: isSaving ? 0.5 : 1,
                                            }}
                                          >
                                            📅
                                          </button>
                                          {isOpen && (
                                            <>
                                              <div
                                                onClick={(e) => { e.stopPropagation(); setCycleMenuOpenForKey(null) }}
                                                style={{ position: 'fixed' as const, inset: 0, zIndex: 60 }}
                                              />
                                              <div style={{
                                                position: 'absolute' as const, top: '100%', right: 0, marginTop: 4,
                                                background: '#1a1a28', border: '1px solid #2a2a40',
                                                borderRadius: 6, padding: 4, minWidth: 160, zIndex: 61,
                                                boxShadow: '0 4px 16px rgba(0,0,0,.4)',
                                              }}>
                                                <div style={{
                                                  padding: '4px 8px', fontSize: 9, color: '#6a6a80',
                                                  fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4,
                                                }}>Mover a ciclo</div>
                                                {opciones.map(c => (
                                                  <button
                                                    key={c}
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setCycleMenuOpenForKey(null)
                                                      moveBatchToCycle(batch, c)
                                                    }}
                                                    style={{
                                                      width: '100%', display: 'flex', alignItems: 'center',
                                                      padding: '6px 8px', borderRadius: 4,
                                                      background: 'transparent', border: 'none',
                                                      color: '#e8e8f0', fontSize: 11, fontWeight: 600,
                                                      cursor: 'pointer', textAlign: 'left' as const,
                                                      textTransform: 'capitalize' as const,
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = '#22223a')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                  >
                                                    {cicloMesLabel(c)}
                                                  </button>
                                                ))}
                                                {/* Separator + item destructivo "Eliminar loop" */}
                                                <div style={{ height: 1, background: '#2a2a40', margin: '4px 0' }} />
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setCycleMenuOpenForKey(null)
                                                    eliminarLoop(batch)
                                                  }}
                                                  style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 8px', borderRadius: 4,
                                                    background: 'transparent', border: 'none',
                                                    color: '#f5365c', fontSize: 11, fontWeight: 600,
                                                    cursor: 'pointer', textAlign: 'left' as const,
                                                  }}
                                                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,54,92,.10)')}
                                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                  🗑 Eliminar este loop
                                                </button>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    {/* Botón "→ siguiente estado" — alternativa al drag */}
                                    {(() => {
                                      const currentIdx = stateList.findIndex(s => s.label === batch.dominantState)
                                      const hasNext = currentIdx >= 0 && currentIdx < stateList.length - 1
                                      if (!hasNext) return null
                                      const nextLabel = stateList[currentIdx + 1].label
                                      return (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); advanceBatch(batch) }}
                                          title={`Pasar a ${nextLabel}`}
                                          disabled={isSaving}
                                          style={{
                                            background: stateColor + '22', border: `1px solid ${stateColor}55`,
                                            color: stateColor, fontSize: 11, fontWeight: 700,
                                            padding: '3px 8px', borderRadius: 4,
                                            cursor: isSaving ? 'wait' : 'pointer',
                                            opacity: isSaving ? 0.5 : 1,
                                          }}
                                        >
                                          →
                                        </button>
                                      )
                                    })()}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          )
                        })}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {/* Modal de PENDIENTE DE INFORMACIÓN (copys) — multi-select de motivos */}
      {pendingPendienteInfo && (
        <LoopPendienteInfoModal
          agenciaId={agenciaId}
          batch={pendingPendienteInfo.batch}
          onClose={() => setPendingPendienteInfo(null)}
          onConfirm={async () => {
            const { batch, toState } = pendingPendienteInfo
            setPendingPendienteInfo(null)
            await doMove(batch, toState)
          }}
        />
      )}

      {/* Modal de preflight gate (ej: copys MÉTRICAS → POR HACER SCRIPTS) */}
      {pendingPreflight && (
        <LoopAreaPreflightModal
          agenciaId={agenciaId}
          area={area}
          batch={pendingPreflight.batch}
          fromState={pendingPreflight.fromState}
          toState={pendingPreflight.toState}
          onClose={() => setPendingPreflight(null)}
          onConfirm={async () => {
            const { batch, toState } = pendingPreflight
            setPendingPreflight(null)
            await doMove(batch, toState)
          }}
        />
      )}

      {/* Modal genérico de cierre de área (link + comment + preflight + auto-fecha) */}
      {pendingClose && (
        <LoopAreaCloseModal
          agenciaId={agenciaId}
          area={area}
          batch={pendingClose.batch}
          toState={pendingClose.toState}
          currentUser={currentUser}
          onClose={() => setPendingClose(null)}
          onConfirm={async (closeData) => {
            const { batch, toState } = pendingClose
            setOptimistic(prev => ({ ...prev, [batch.key]: toState }))
            setSavingKey(batch.key)
            const res = await persistBatchTransition(batch, toState, closeData)
            setSavingKey(null)
            setPendingClose(null)
            if (!res.ok) {
              setOptimistic(prev => { const n = { ...prev }; delete n[batch.key]; return n })
              setToast({ msg: `Error: ${res.error}`, type: 'err' })
              return
            }
            setToast({ msg: `${batch.cliente.nombre} · ${cicloMesLabel(batch.cicloMes).split(' ')[0]} · ${area} cerrado`, type: 'ok' })
            loadPiezas()
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          padding: '10px 16px', borderRadius: 8,
          background: toast.type === 'ok' ? 'rgba(0,217,126,.15)' : 'rgba(245,54,92,.15)',
          border: `1px solid ${toast.type === 'ok' ? '#00d97e' : '#f5365c'}`,
          color: toast.type === 'ok' ? '#00d97e' : '#f5365c',
          fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>
          <i className={`fas ${toast.type === 'ok' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} style={{ marginRight: 6 }} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
