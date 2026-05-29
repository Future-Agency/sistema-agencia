'use client'
import { useMemo, useState } from 'react'
import type { Cliente, ClienteCicloRecursos, Pieza } from '@/lib/supabase'
import {
  PIPELINE_BY_TIPO,
  fechaGrabacionPrevista,
  diasAtrasoCopys,
  ANTICIPACION_COPYS_DIAS,
} from '@/lib/piezas'

type Props = {
  clientes: Cliente[]
  piezas: Pieza[]
  recursosByLoop?: Map<string, ClienteCicloRecursos>
  fechasContenidoHasta?: Map<number, { fecha: Date; confirmada: boolean }>
  cicloActivo: string
  onSelectCliente?: (c: Cliente) => void
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

type Row = {
  cliente: Cliente
  estadoCopys: string
  fechaGrab: Date | null
  fechaGrabTipo: 'confirmada' | 'tentativa' | 'estimada' | null
  diasParaEmpezar: number | null  // negativo = atrasado, positivo = falta. null = sin datos.
  yaListo: boolean
}

function fmtFecha(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function colByEstado(d: number | null, ya: boolean) {
  if (ya) return { bg: 'rgba(0,217,126,.10)', border: 'rgba(0,217,126,.30)', color: '#00d97e', label: '✅ LISTO' }
  if (d === null) return { bg: 'rgba(106,106,128,.10)', border: 'rgba(106,106,128,.30)', color: '#6a6a80', label: '—' }
  if (d < 0) return { bg: 'rgba(245,54,92,.10)',  border: 'rgba(245,54,92,.30)',  color: '#f5365c', label: `🔥 ${Math.abs(d)}d atraso` }
  if (d <= 7) return { bg: 'rgba(245,166,35,.10)', border: 'rgba(245,166,35,.30)', color: '#f5a623', label: `🟡 en ${d}d` }
  if (d <= 21) return { bg: 'rgba(94,114,228,.10)', border: 'rgba(94,114,228,.30)', color: '#5e72e4', label: `🟢 en ${d}d` }
  return { bg: 'rgba(106,106,128,.08)', border: 'rgba(106,106,128,.25)', color: '#a0a0b8', label: `en ${d}d` }
}

export default function TableroPlanProduccion({ clientes, piezas, recursosByLoop, fechasContenidoHasta, cicloActivo, onSelectCliente }: Props) {
  const [verSoloUrgentes, setVerSoloUrgentes] = useState(false)

  const rows = useMemo<Row[]>(() => {
    // Para cada cliente, calcular estado copys del ciclo activo + atraso
    const out: Row[] = []
    for (const c of clientes) {
      // Piezas del cliente en el ciclo activo que pasan por copys
      const piezasCliente = piezas.filter(p =>
        p.cliente_id === c.id &&
        p.ciclo_mes === cicloActivo &&
        PIPELINE_BY_TIPO[p.tipo]?.includes('copys')
      )
      if (piezasCliente.length === 0) continue

      // Estado dominante en copys: el primero no aprobado, o LISTO si todos aprobados
      let yaListo = piezasCliente.every(p => isApproved(p.estado_copys))
      // Estado dominante: el más frecuente entre los no aprobados (o "LISTO PARA GRABAR" si yaListo)
      let estado = 'LISTO PARA GRABAR'
      if (!yaListo) {
        const counts = new Map<string, number>()
        for (const p of piezasCliente) {
          if (isApproved(p.estado_copys)) continue
          const v = (p.estado_copys || '').trim() || 'MÉTRICAS'
          counts.set(v, (counts.get(v) ?? 0) + 1)
        }
        let max = 0
        for (const [k, v] of Array.from(counts.entries())) {
          if (v > max) { max = v; estado = k }
        }
      }

      const rec = recursosByLoop?.get(`${c.id}::${cicloActivo}`) ?? null
      const fc = fechasContenidoHasta?.get(c.id) ?? null
      const fechaGrab = fechaGrabacionPrevista(
        rec?.fecha_grabacion_confirmada,
        rec?.fecha_grabacion_tentativa,
        fc?.fecha ?? null,
      )
      const fechaGrabTipo: Row['fechaGrabTipo'] =
        rec?.fecha_grabacion_confirmada ? 'confirmada' :
        rec?.fecha_grabacion_tentativa ? 'tentativa' :
        fc?.fecha ? 'estimada' : null

      let diasParaEmpezar: number | null = null
      if (fechaGrab) {
        // días entre hoy y fecha límite de copys (grabación - 21d)
        const limite = new Date(fechaGrab)
        limite.setDate(limite.getDate() - ANTICIPACION_COPYS_DIAS)
        limite.setHours(0, 0, 0, 0)
        const now = new Date(); now.setHours(0, 0, 0, 0)
        diasParaEmpezar = Math.floor((limite.getTime() - now.getTime()) / 86400000)
      }
      out.push({ cliente: c, estadoCopys: estado, fechaGrab, fechaGrabTipo, diasParaEmpezar, yaListo })
    }
    return out
  }, [clientes, piezas, recursosByLoop, fechasContenidoHasta, cicloActivo])

  const grupos = useMemo(() => {
    const atrasados: Row[] = []
    const urgentes: Row[] = []
    const proximos: Row[] = []
    const tranquilos: Row[] = []
    const listos: Row[] = []
    const sinDatos: Row[] = []
    for (const r of rows) {
      if (r.yaListo) { listos.push(r); continue }
      if (r.diasParaEmpezar === null) { sinDatos.push(r); continue }
      if (r.diasParaEmpezar < 0) atrasados.push(r)
      else if (r.diasParaEmpezar <= 7) urgentes.push(r)
      else if (r.diasParaEmpezar <= 21) proximos.push(r)
      else tranquilos.push(r)
    }
    // Ordenar
    atrasados.sort((a, b) => (a.diasParaEmpezar ?? 0) - (b.diasParaEmpezar ?? 0))
    urgentes.sort((a, b) => (a.diasParaEmpezar ?? 0) - (b.diasParaEmpezar ?? 0))
    proximos.sort((a, b) => (a.diasParaEmpezar ?? 0) - (b.diasParaEmpezar ?? 0))
    tranquilos.sort((a, b) => (a.diasParaEmpezar ?? 0) - (b.diasParaEmpezar ?? 0))
    return { atrasados, urgentes, proximos, tranquilos, listos, sinDatos }
  }, [rows])

  const totalUrgentes = grupos.atrasados.length + grupos.urgentes.length

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap' as const, gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>📋 Plan de Producción · {cicloActivo}</h2>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0, marginTop: 2 }}>
            Qué clientes hay que empezar a guionizar para no atrasarse vs próxima grabación.
            <strong style={{ color: '#f5365c', marginLeft: 6 }}>{totalUrgentes} urgentes</strong>.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a0a0b8', cursor: 'pointer' }}>
          <input type="checkbox" checked={verSoloUrgentes} onChange={e => setVerSoloUrgentes(e.target.checked)} />
          Solo urgentes (atrasados + ≤7d)
        </label>
      </div>

      <Section title="🔥 ATRASADOS" subtitle="Tienen que arrancar YA" color="#f5365c" rows={grupos.atrasados} onSelect={onSelectCliente} />
      <Section title="🟡 ESTA SEMANA" subtitle="Empezar en los próximos 7 días" color="#f5a623" rows={grupos.urgentes} onSelect={onSelectCliente} />
      {!verSoloUrgentes && (
        <>
          <Section title="🟢 PRÓXIMAS 3 SEMANAS" subtitle="En agenda, no urgentes" color="#5e72e4" rows={grupos.proximos} onSelect={onSelectCliente} />
          <Section title="✅ YA LISTOS" subtitle="Scripts terminados — listos para grabar" color="#00d97e" rows={grupos.listos} onSelect={onSelectCliente} />
          {grupos.tranquilos.length > 0 && (
            <Section title="⏳ MÁS DE 3 SEMANAS" subtitle="Lejos en el tiempo" color="#a0a0b8" rows={grupos.tranquilos} onSelect={onSelectCliente} />
          )}
          {grupos.sinDatos.length > 0 && (
            <Section title="❓ SIN FECHA DE GRABACIÓN" subtitle="Falta cargar fecha tentativa, confirmada, o cerrar Subida del ciclo anterior" color="#6a6a80" rows={grupos.sinDatos} onSelect={onSelectCliente} />
          )}
        </>
      )}

      {rows.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center' as const, color: '#6a6a80' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌴</div>
          <p style={{ fontSize: 13 }}>Sin clientes con piezas de copys en el ciclo activo ({cicloActivo}).</p>
        </div>
      )}
    </div>
  )
}

function Section({ title, subtitle, color, rows, onSelect }: { title: string; subtitle: string; color: string; rows: Row[]; onSelect?: (c: Cliente) => void }) {
  if (rows.length === 0) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
          {title} <span style={{ color: '#6a6a80', fontWeight: 600 }}>({rows.length})</span>
        </div>
        <div style={{ fontSize: 11, color: '#6a6a80' }}>{subtitle}</div>
      </div>
      <div style={{ background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 8, overflow: 'hidden' as const }}>
        {rows.map((r, i) => {
          const col = colByEstado(r.diasParaEmpezar, r.yaListo)
          return (
            <div key={r.cliente.id}
              onClick={() => onSelect?.(r.cliente)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                borderTop: i > 0 ? '1px solid #2a2a40' : 'none',
                cursor: onSelect ? 'pointer' : 'default',
                transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#22223a')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ flex: '0 0 180px', fontSize: 13, fontWeight: 700 }}>{r.cliente.nombre}</div>
              <div style={{ flex: '1 1 auto', fontSize: 11, color: '#a0a0b8' }}>
                <span style={{ color: '#5e72e4', fontWeight: 600 }}>{r.estadoCopys}</span>
                {r.fechaGrab && (
                  <span style={{ marginLeft: 10, color: '#6a6a80' }}>
                    · grab <strong style={{ color: '#e8e8f0' }}>{fmtFecha(r.fechaGrab)}</strong>
                    <span style={{ fontSize: 9, marginLeft: 4, color: '#6a6a80' }}>({r.fechaGrabTipo})</span>
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                background: col.bg, border: `1px solid ${col.border}`, color: col.color,
                flexShrink: 0,
              }}>{col.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
