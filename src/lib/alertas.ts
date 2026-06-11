// Computa alertas operativas urgentes para mostrar en una sola vista accionable.
// Cada alerta tiene severidad, contexto y un cliente sobre el que actuar.

import type { Cliente, ClienteCicloRecursos, DeudaContenido, FechaEspecial, Pieza } from './supabase'
import type { UserArea } from './users'
import {
  PIPELINE_BY_TIPO,
  diasEnEstadoBatch,
  diasAtrasoCopys,
  fechaGrabacionPrevista,
  ANTICIPACION_COPYS_DIAS,
} from './piezas'
import { ESTADO_PENDIENTE_INFO_LABEL } from './areaStates'

export type SeveridadAlerta = 'critica' | 'urgente' | 'aviso'

export type Alerta = {
  id: string
  severidad: SeveridadAlerta
  icono: string
  titulo: string             // "Bylop · 5d de atraso en copys"
  descripcion: string        // "Próxima grabación 16/jun. Scripts debían estar listos hace 5 días."
  clienteId?: number
  area?: UserArea
  accion: string             // "ir a Copys"
  score: number              // mayor = más urgente; para ordenar
}

const APPROVED = new Set([
  'APROBADO', 'APROBADO - SUBIDA A CLICKUP', 'PUBLICADO',
  'METRICAS Y VOLVER A EMPEZAR', 'MÉTRICAS Y VOLVER A EMPEZAR',
  'VOLVER A EMPEZAR', 'MATERIAL APROBADO', 'MATERIAL SUBIDO', 'LISTO PARA GRABAR',
])
function isApproved(v: string | null | undefined): boolean {
  if (!v) return false
  return APPROVED.has(v.toUpperCase())
}
function colFor(a: UserArea): string {
  return a === 'edit' ? 'estado_edicion' : `estado_${a}`
}
function piezaEnArea(p: Pieza, area: UserArea): boolean {
  const pipeline = PIPELINE_BY_TIPO[p.tipo]
  if (!pipeline.includes(area)) return false
  const idx = pipeline.indexOf(area)
  for (let i = 0; i < idx; i++) {
    if (!isApproved((p as Record<string, unknown>)[colFor(pipeline[i])] as string | null)) return false
  }
  const v = (p as Record<string, unknown>)[colFor(area)] as string | null
  if (isApproved(v) && idx !== pipeline.length - 1) return false
  return true
}

export type ComputarInput = {
  clientes: Cliente[]
  piezas: Pieza[]
  deudas: DeudaContenido[]
  recursos: ClienteCicloRecursos[]
  fechas: FechaEspecial[]
  fechasContenidoHasta: Map<number, { fecha: Date; confirmada: boolean }>
  cicloActivo: string
}

export function computarAlertas(input: ComputarInput): Alerta[] {
  const out: Alerta[] = []
  const clienteById = new Map(input.clientes.map(c => [c.id, c]))
  const recursosByLoop = new Map<string, ClienteCicloRecursos>()
  for (const r of input.recursos) recursosByLoop.set(`${r.cliente_id}::${r.ciclo_mes}`, r)

  // 1. ATRASOS DE COPYS (vs próxima grabación prevista)
  for (const c of input.clientes) {
    const piezasCopys = input.piezas.filter(p =>
      p.cliente_id === c.id && p.ciclo_mes === input.cicloActivo &&
      PIPELINE_BY_TIPO[p.tipo]?.includes('copys')
    )
    if (piezasCopys.length === 0) continue
    if (piezasCopys.every(p => isApproved(p.estado_copys))) continue  // ya listo
    const rec = recursosByLoop.get(`${c.id}::${input.cicloActivo}`) ?? null
    const fc = input.fechasContenidoHasta.get(c.id) ?? null
    const fechaGrab = fechaGrabacionPrevista(
      rec?.fecha_grabacion_confirmada,
      rec?.fecha_grabacion_tentativa,
      fc?.fecha ?? null,
    )
    const atraso = diasAtrasoCopys(fechaGrab)
    if (atraso <= 0) continue
    const sev: SeveridadAlerta = atraso > 7 ? 'critica' : atraso > 2 ? 'urgente' : 'aviso'
    out.push({
      id: `atraso-copys-${c.id}`,
      severidad: sev,
      icono: '🔥',
      titulo: `${c.nombre} · ${atraso}d de atraso en copys`,
      descripcion: `Próxima grabación ${fechaGrab?.toLocaleDateString('es-AR')}. Scripts debían estar listos hace ${atraso}d (SLA: ${ANTICIPACION_COPYS_DIAS}d).`,
      clienteId: c.id, area: 'copys', accion: 'Ir a Copys',
      score: 1000 + atraso * 10,
    })
  }

  // 2. DEUDAS PENDIENTES asignadas al ciclo activo
  const deudasPorCliente = new Map<number, number>()
  for (const d of input.deudas) {
    if (d.estado !== 'pendiente') continue
    if (d.ciclo_asignado !== input.cicloActivo) continue
    if (d.cantidad <= 0) continue  // solo "debemos" (no a favor)
    deudasPorCliente.set(d.cliente_id, (deudasPorCliente.get(d.cliente_id) ?? 0) + d.cantidad)
  }
  deudasPorCliente.forEach((total, clienteId) => {
    const c = clienteById.get(clienteId)
    if (!c) return
    const sev: SeveridadAlerta = total > 10 ? 'critica' : total > 3 ? 'urgente' : 'aviso'
    out.push({
      id: `deuda-${clienteId}`,
      severidad: sev,
      icono: '🔒',
      titulo: `${c.nombre} · ${total} contenidos de deuda`,
      descripcion: `Asignados al ciclo ${input.cicloActivo}. Bloquean el cierre del ciclo del cliente.`,
      clienteId, accion: 'Ir a Deudas',
      score: 900 + total * 5,
    })
  })

  // 3. PEND.INFO sin link (batches con estado_copys=PENDIENTE DE INFO que llevan >2 días)
  for (const c of input.clientes) {
    const piezasPend = input.piezas.filter(p =>
      p.cliente_id === c.id && p.ciclo_mes === input.cicloActivo &&
      p.estado_copys?.toUpperCase() === ESTADO_PENDIENTE_INFO_LABEL.toUpperCase()
    )
    if (piezasPend.length === 0) continue
    const rec = recursosByLoop.get(`${c.id}::${input.cicloActivo}`) ?? null
    const noAplica = !!rec?.pendiente_info_no_aplica
    const tieneLink = !!(rec?.pendiente_info_link?.trim())
    if (noAplica || tieneLink) continue  // ya resuelto
    const dias = diasEnEstadoBatch(piezasPend) ?? 0
    if (dias <= 2) continue  // recién entró, no urge todavía
    const sev: SeveridadAlerta = dias > 7 ? 'critica' : dias > 4 ? 'urgente' : 'aviso'
    out.push({
      id: `pend-info-${c.id}`,
      severidad: sev,
      icono: '⏸️',
      titulo: `${c.nombre} · ${dias}d sin info para arrancar`,
      descripcion: 'PEND.INFO sin link cargado ni marcado como NO APLICA. El equipo está bloqueado esperando.',
      clienteId: c.id, area: 'copys', accion: 'Ir a Copys',
      score: 850 + dias * 8,
    })
  }

  // 4. CONTENIDO HASTA vencido o por vencer
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  input.fechasContenidoHasta.forEach((fc, clienteId) => {
    const c = clienteById.get(clienteId)
    if (!c) return
    const d = new Date(fc.fecha); d.setHours(0, 0, 0, 0)
    const dias = Math.floor((d.getTime() - hoy.getTime()) / 86400000)
    if (dias > 7) return  // todavía hay margen
    const sev: SeveridadAlerta = dias < 0 ? 'critica' : dias <= 3 ? 'urgente' : 'aviso'
    out.push({
      id: `contenido-hasta-${clienteId}`,
      severidad: sev,
      icono: '📅',
      titulo: dias < 0
        ? `${c.nombre} · sin contenido hace ${Math.abs(dias)}d`
        : `${c.nombre} · contenido se acaba en ${dias}d`,
      descripcion: `Última publicación programada: ${d.toLocaleDateString('es-AR')}${fc.confirmada ? '' : ' (estimada)'}.`,
      clienteId, accion: 'Ir al detalle',
      score: 800 + (dias < 0 ? Math.abs(dias) * 15 : (10 - dias) * 5),
    })
  })

  // 5. BATCHES VIEJOS en el mismo estado (>5d, sin moverse, no en estado terminal)
  const AREAS: UserArea[] = ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios']
  for (const a of AREAS) {
    // Agrupar piezas activas por (cliente, ciclo) para esta área
    const byLoop = new Map<string, Pieza[]>()
    for (const p of input.piezas) {
      if (p.ciclo_mes !== input.cicloActivo) continue
      if (!piezaEnArea(p, a)) continue
      const k = `${p.cliente_id}::${p.ciclo_mes}`
      if (!byLoop.has(k)) byLoop.set(k, [])
      byLoop.get(k)!.push(p)
    }
    byLoop.forEach((piezas, k) => {
      const dias = diasEnEstadoBatch(piezas) ?? 0
      if (dias <= 5) return
      const clienteId = piezas[0].cliente_id
      const c = clienteById.get(clienteId)
      if (!c) return
      // Evitar duplicar con atraso-copys
      if (a === 'copys' && out.some(x => x.id === `atraso-copys-${clienteId}`)) return
      const estado = (piezas[0] as Record<string, unknown>)[colFor(a)] as string | null
      const sev: SeveridadAlerta = dias > 10 ? 'urgente' : 'aviso'
      out.push({
        id: `viejo-${a}-${k}`,
        severidad: sev,
        icono: '⏱️',
        titulo: `${c.nombre} · ${dias}d en ${a.toUpperCase()}`,
        descripcion: `Sin movimientos en estado "${estado || '—'}" hace ${dias} días.`,
        clienteId, area: a, accion: `Ir a ${a}`,
        score: 500 + dias * 3,
      })
    })
  }

  // 6. FECHAS ESPECIALES en rango con info_lista=false
  for (const f of input.fechas) {
    if (!f.fecha_evento) continue
    const fEv = new Date(f.fecha_evento); fEv.setHours(0, 0, 0, 0)
    const dias = Math.floor((fEv.getTime() - hoy.getTime()) / 86400000)
    if (dias < 0) continue
    if (dias > f.dias_anticipacion) continue
    if (f.info_lista) continue
    if (!f.info_requerida) continue
    const sev: SeveridadAlerta = dias <= 5 ? 'critica' : 'urgente'
    out.push({
      id: `fecha-especial-${f.id}`,
      severidad: sev,
      icono: '🎉',
      titulo: `${f.nombre} · en ${dias}d · info pendiente`,
      descripcion: `${f.info_requerida}`,
      accion: 'Ir a Fechas Especiales',
      score: 700 + (f.dias_anticipacion - dias) * 4,
    })
  }

  return out.sort((a, b) => b.score - a.score)
}

export function severidadColor(s: SeveridadAlerta): { bg: string; border: string; color: string; bgSolid: string } {
  switch (s) {
    case 'critica': return { bg: 'rgba(245,54,92,.10)',  border: 'rgba(245,54,92,.40)',  color: '#f5365c', bgSolid: '#f5365c' }
    case 'urgente': return { bg: 'rgba(245,166,35,.10)', border: 'rgba(245,166,35,.40)', color: '#f5a623', bgSolid: '#f5a623' }
    case 'aviso':   return { bg: 'rgba(94,114,228,.10)', border: 'rgba(94,114,228,.40)', color: '#5e72e4', bgSolid: '#5e72e4' }
  }
}
