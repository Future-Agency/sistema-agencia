// API route: genera el reporte de cierre de ciclo
// POST /api/reporte-cierre con body { agenciaId, cicloMes }
// → junta data del ciclo (clientes, piezas, notas, deudas, fechas especiales)
// → si ANTHROPIC_API_KEY existe, pide análisis a Claude
// → sino devuelve análisis local con estadísticas básicas

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { agenciaId: string; cicloMes: string }

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body
  const { agenciaId, cicloMes } = body
  if (!agenciaId || !cicloMes) {
    return NextResponse.json({ error: 'agenciaId y cicloMes requeridos' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const sb = createClient(url, key)

  // 1. Juntar toda la data relevante del ciclo
  const [clientesRes, piezasRes, notasRes, deudasRes, fechasRes, recursosRes] = await Promise.all([
    sb.from('clientes').select('id, nombre, plan_videos, plan_portadas, plan_carrouseles, plan_historias, owner_id, tipo').eq('agencia_id', agenciaId).eq('activo', true),
    sb.from('piezas').select('cliente_id, ciclo_mes, tipo, estado_copys, estado_grab, estado_edicion, estado_diseno, estado_subida, estado_anuncios').eq('agencia_id', agenciaId).eq('ciclo_mes', cicloMes),
    sb.from('pipeline_notas').select('*').eq('agencia_id', agenciaId).eq('ciclo_mes', cicloMes).order('created_at', { ascending: true }),
    sb.from('deudas_contenido').select('*').eq('agencia_id', agenciaId).eq('ciclo_origen', cicloMes),
    sb.from('fechas_especiales').select('*').eq('agencia_id', agenciaId),
    sb.from('cliente_ciclo_recursos').select('*').eq('agencia_id', agenciaId).eq('ciclo_mes', cicloMes),
  ])

  const clientes = clientesRes.data ?? []
  const piezas = piezasRes.data ?? []
  const notas = notasRes.data ?? []
  const deudas = deudasRes.data ?? []
  const fechas = fechasRes.data ?? []
  const recursos = recursosRes.data ?? []

  // 2. Estadísticas básicas
  const stats = computeStats(clientes, piezas, notas, deudas, recursos)

  // 3. Análisis: Claude si hay key, sino local
  const apiKey = process.env.ANTHROPIC_API_KEY
  let analisis: { resumen: string; fortalezas: string[]; debilidades: string[]; recomendaciones: string[]; generadoPor: 'claude' | 'local' }
  if (apiKey) {
    try {
      analisis = await analisisConClaude(apiKey, { cicloMes, stats, clientes, notas, deudas })
    } catch (err) {
      console.warn('[reporte-cierre] Claude falló, usando local:', err)
      analisis = analisisLocal(stats, notas, deudas)
    }
  } else {
    analisis = analisisLocal(stats, notas, deudas)
  }

  return NextResponse.json({
    cicloMes,
    stats,
    notas,
    deudas,
    fechas,
    analisis,
    generadoEn: new Date().toISOString(),
  })
}

// ============== Helpers ==============

function computeStats(clientes: any[], piezas: any[], notas: any[], deudas: any[], recursos: any[]) {
  const TERMINALES = new Set(['APROBADO', 'APROBADO - SUBIDA A CLICKUP', 'PUBLICADO', 'MÉTRICAS', 'METRICAS', 'VOLVER A EMPEZAR', 'METRICAS Y VOLVER A EMPEZAR'])
  const PIPELINE_BY_TIPO: Record<string, string[]> = {
    video:     ['copys', 'grab', 'edit', 'diseno', 'subida', 'anuncios'],
    portada:   ['diseno', 'subida', 'anuncios'],
    carrousel: ['copys', 'diseno', 'subida', 'anuncios'],
    historia:  ['copys', 'diseno', 'subida', 'anuncios'],
  }
  const colFor = (a: string) => a === 'edit' ? 'estado_edicion' : `estado_${a}`

  // Loops por cliente
  const loopsByCliente = new Map<number, any[]>()
  for (const p of piezas) {
    if (!loopsByCliente.has(p.cliente_id)) loopsByCliente.set(p.cliente_id, [])
    loopsByCliente.get(p.cliente_id)!.push(p)
  }

  // Completados: cliente cuyas todas las piezas tienen último estado del pipeline aprobado
  let completados = 0
  let conPiezas = 0
  let totalPiezas = 0
  let piezasTerminadas = 0
  for (const c of clientes) {
    const ps = loopsByCliente.get(c.id) ?? []
    if (ps.length === 0) continue
    conPiezas++
    totalPiezas += ps.length
    const allDone = ps.every((p: any) => {
      const last = PIPELINE_BY_TIPO[p.tipo]?.at(-1) ?? 'subida'
      const v = p[colFor(last)] as string | undefined
      const ok = v && TERMINALES.has(v.toUpperCase())
      if (ok) piezasTerminadas++
      return ok
    })
    if (allDone) completados++
  }

  // Notas por tipo y por área
  const notasPorTipo: Record<string, number> = { nota: 0, falla: 0, correccion: 0, mejora: 0 }
  const notasPorArea: Record<string, number> = {}
  for (const n of notas) {
    notasPorTipo[n.tipo] = (notasPorTipo[n.tipo] ?? 0) + 1
    notasPorArea[n.area] = (notasPorArea[n.area] ?? 0) + 1
  }

  // Deudas
  const deudasPendientes = deudas.filter((d: any) => d.estado === 'pendiente')
  const deudasNeto = deudasPendientes.reduce((s: number, d: any) => s + d.cantidad, 0)

  return {
    clientesActivos: clientes.length,
    clientesConPiezas: conPiezas,
    clientesCompletados: completados,
    porcentajeCompletado: conPiezas > 0 ? Math.round(completados / conPiezas * 100) : 0,
    totalPiezas,
    piezasTerminadas,
    porcentajePiezas: totalPiezas > 0 ? Math.round(piezasTerminadas / totalPiezas * 100) : 0,
    notasPorTipo,
    notasPorArea,
    deudasCount: deudasPendientes.length,
    deudasNeto,
    recursosCargados: recursos.length,
  }
}

async function analisisConClaude(apiKey: string, ctx: any) {
  const prompt = `Sos analista de operaciones de una agencia de marketing. Te paso datos del ciclo "${ctx.cicloMes}" para que armes un reporte de cierre.

ESTADÍSTICAS:
${JSON.stringify(ctx.stats, null, 2)}

NOTAS REGISTRADAS (${ctx.notas.length}):
${ctx.notas.slice(0, 50).map((n: any) => `- [${n.area}/${n.tipo}] ${n.texto}`).join('\n')}

DEUDAS DE CONTENIDO (${ctx.deudas.length}):
${ctx.deudas.slice(0, 20).map((d: any) => `- ${d.cantidad > 0 ? '+' : ''}${d.cantidad} (cliente ${d.cliente_id}, ${d.motivo ?? 's/m'})`).join('\n')}

Devolvé SOLO un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):
{
  "resumen": "1-2 frases que resuman cómo fue el ciclo",
  "fortalezas": ["punto 1", "punto 2", "punto 3"],
  "debilidades": ["punto 1", "punto 2", "punto 3"],
  "recomendaciones": ["accionable 1", "accionable 2", "accionable 3"]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude HTTP ${res.status}`)
  const data = await res.json() as { content: { text: string }[] }
  const text = data.content?.[0]?.text ?? '{}'
  // Sacar wrappers de markdown por si acaso
  const clean = text.replace(/^```json\n?|\n?```$/g, '').trim()
  const parsed = JSON.parse(clean)
  return { ...parsed, generadoPor: 'claude' as const }
}

function analisisLocal(stats: any, notas: any[], deudas: any[]) {
  const fortalezas: string[] = []
  const debilidades: string[] = []
  const recomendaciones: string[] = []

  if (stats.porcentajeCompletado >= 80) fortalezas.push(`Alta tasa de completación: ${stats.porcentajeCompletado}% de los clientes con piezas cerraron el ciclo.`)
  else if (stats.porcentajeCompletado < 50) debilidades.push(`Baja tasa de completación: solo ${stats.porcentajeCompletado}% de los clientes con piezas cerraron el ciclo.`)

  if (stats.notasPorTipo.falla > 0) debilidades.push(`Se registraron ${stats.notasPorTipo.falla} fallas durante el ciclo.`)
  if (stats.notasPorTipo.mejora > 0) fortalezas.push(`${stats.notasPorTipo.mejora} ideas de mejora propuestas por el equipo.`)
  if (stats.notasPorTipo.correccion > 3) recomendaciones.push(`Hubo ${stats.notasPorTipo.correccion} correcciones — revisar el proceso para reducir reprocesos.`)

  if (stats.deudasNeto > 0) {
    debilidades.push(`Deuda de contenido neta: debemos ${stats.deudasNeto} contenidos a clientes.`)
    recomendaciones.push('Priorizar saldar las deudas pendientes el próximo ciclo.')
  }
  if (stats.deudasNeto < 0) fortalezas.push(`Saldo a favor de ${Math.abs(stats.deudasNeto)} contenidos: entregamos más de lo pactado.`)

  // Top área con notas
  const topArea = Object.entries(stats.notasPorArea as Record<string, number>).sort((a, b) => b[1] - a[1])[0]
  if (topArea && topArea[1] > 0) {
    recomendaciones.push(`El área "${topArea[0]}" concentró ${topArea[1]} notas. Vale revisarla en la próxima reunión.`)
  }

  if (fortalezas.length === 0) fortalezas.push('Sin observaciones positivas registradas — agregar notas tipo "mejora" en próximos ciclos.')
  if (debilidades.length === 0) debilidades.push('Sin debilidades destacadas en este ciclo.')
  if (recomendaciones.length === 0) recomendaciones.push('Mantener el ritmo del ciclo actual.')

  const resumen = stats.clientesConPiezas > 0
    ? `Ciclo con ${stats.clientesConPiezas} clientes activos. ${stats.clientesCompletados} completaron al 100% (${stats.porcentajeCompletado}%). ${stats.piezasTerminadas}/${stats.totalPiezas} piezas terminadas (${stats.porcentajePiezas}%).`
    : 'Ciclo sin piezas registradas — sin datos para análisis.'

  return { resumen, fortalezas, debilidades, recomendaciones, generadoPor: 'local' as const }
}
