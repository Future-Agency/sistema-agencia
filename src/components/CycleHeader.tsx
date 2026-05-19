'use client'
import { useMemo } from 'react'
import type { Cliente, Pieza } from '@/lib/supabase'
import { loopEstaCompletado } from '@/lib/piezas'

type Props = {
  clientes: Cliente[]
  /** Mes calendario actual (YYYY-MM). v2 usaremos ciclo_mes de la tabla. */
  cycleLabel?: string
  /** Índice piezas por `${cliente_id}::${ciclo_mes}` — para calcular "completaron"
   *  desde las piezas en vez de depender de cliente.estado. */
  piezasByLoop?: Map<string, Pieza[]>
  /** Ciclo activo (el del CycleSelector). Necesario para mirar el subset de piezas. */
  cicloActual?: string
  /** Map<cliente_id, count> de deudas pendientes ASIGNADAS al ciclo actual.
   *  Un cliente con deudas pendientes asignadas NO se cuenta como "completado",
   *  aunque sus piezas estén todas terminadas — el ciclo no cierra hasta saldarlas. */
  deudasPendientesByCliente?: Map<number, number>
}

// Estados que indican "deployment / cierre de ciclo"
const ESTADOS_DEPLOYMENT = new Set([
  'ANUNCIOS PRENDIDOS',
  'ANUNCIOS CHECK',
  'REPORTE ADS + ORGÁNICO',
  'VOLVER A EMPEZAR',
  // Legacy
  'METRICAS Y VOLVER A EMPEZAR',
  'PROGAMADO',
])
// Cierre canónico — loop terminado, listo para arrancar el siguiente ciclo
const ESTADO_CIERRE = 'VOLVER A EMPEZAR'
const ESTADO_CIERRE_LEGACY = 'METRICAS Y VOLVER A EMPEZAR'

const MONTH_LABELS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function defaultCycleLabel(): string {
  const d = new Date()
  return MONTH_LABELS_ES[d.getMonth()]
}

export default function CycleHeader({ clientes, cycleLabel, piezasByLoop, cicloActual, deudasPendientesByCliente }: Props) {
  const label = cycleLabel ?? defaultCycleLabel()

  const stats = useMemo(() => {
    const total = clientes.length
    // Completaron: si hay info de piezas para este ciclo, contar los clientes con TODAS sus piezas
    // del ciclo en estado terminal Y SIN deudas pendientes asignadas al ciclo.
    // Sino, fallback al criterio legacy (cliente.estado).
    let completaron = 0
    let bloqueadosPorDeuda = 0
    if (piezasByLoop && cicloActual) {
      for (const c of clientes) {
        const piezas = piezasByLoop.get(`${c.id}::${cicloActual}`) ?? []
        const piezasOk = piezas.length > 0
          ? loopEstaCompletado(piezas)
          : (c.estado === ESTADO_CIERRE || c.estado === ESTADO_CIERRE_LEGACY)
        if (!piezasOk) continue
        // Gate de deudas: si tiene deudas pendientes asignadas al ciclo, NO completa.
        const debe = deudasPendientesByCliente?.get(c.id) ?? 0
        if (debe > 0) { bloqueadosPorDeuda++; continue }
        completaron++
      }
    } else {
      completaron = clientes.filter(c => c.estado === ESTADO_CIERRE || c.estado === ESTADO_CIERRE_LEGACY).length
    }
    const enDeployment = clientes.filter(c => ESTADOS_DEPLOYMENT.has(c.estado)).length
    const enProduccion = total - enDeployment
    const pct = total > 0 ? Math.round((completaron / total) * 100) : 0
    const onboarding = clientes.filter(c => c.is_onboarding).length
    return { total, completaron, enProduccion, enDeployment, pct, onboarding, bloqueadosPorDeuda }
  }, [clientes, piezasByLoop, cicloActual, deudasPendientesByCliente])

  return (
    <div style={{
      marginBottom: 20,
      padding: '18px 22px',
      borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(94,114,228,.12) 0%, rgba(137,101,224,.08) 100%)',
      border: '1px solid rgba(94,114,228,.25)',
    }}>
      {/* Header con mes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🔄</span>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#a0b4f5', textTransform: 'uppercase', letterSpacing: 0.6, margin: 0 }}>
              CICLO DE PRODUCCIÓN
            </h3>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontSize: 11, color: '#8a8aa0', marginTop: 2 }}>
            Lo que se sube en {label}
          </div>
        </div>

        {/* Big % */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#8a8aa0', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
            Avance del ciclo
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, color: stats.pct >= 80 ? '#00d97e' : stats.pct >= 40 ? '#f5a623' : '#5e72e4', lineHeight: 1 }}>
            {stats.pct}<span style={{ fontSize: 18, color: '#6a6a80' }}>%</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 8, background: 'rgba(255,255,255,.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          width: `${stats.pct}%`,
          height: '100%',
          background: stats.pct >= 80 ? 'linear-gradient(90deg, #00d97e 0%, #2dce89 100%)'
                    : stats.pct >= 40 ? 'linear-gradient(90deg, #f5a623 0%, #fbbf24 100%)'
                    : 'linear-gradient(90deg, #5e72e4 0%, #8965e0 100%)',
          transition: 'width .4s',
        }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        <Stat label="Activos" value={stats.total} icon="fa-users" color="#a0a0b8" />
        <Stat label="Completaron" value={stats.completaron} icon="fa-circle-check" color="#00d97e" />
        <Stat label="En producción" value={stats.enProduccion} icon="fa-clapperboard" color="#5e72e4" />
        <Stat label="En deployment" value={stats.enDeployment} icon="fa-rocket" color="#f5a623" />
        {stats.onboarding > 0 && (
          <Stat label="Onboarding" value={stats.onboarding} icon="fa-handshake" color="#8965e0" />
        )}
        {stats.bloqueadosPorDeuda > 0 && (
          <Stat label="Bloq. x deuda" value={stats.bloqueadosPorDeuda} icon="fa-lock" color="#f5365c" />
        )}
      </div>
      {stats.bloqueadosPorDeuda > 0 && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(245,54,92,.08)', border: '1px solid rgba(245,54,92,.30)',
          fontSize: 11, color: '#f5365c',
        }}>
          🔒 <strong>{stats.bloqueadosPorDeuda} cliente{stats.bloqueadosPorDeuda > 1 ? 's' : ''}</strong> con piezas terminadas pero el ciclo no cierra — tiene deudas pendientes asignadas a este ciclo.
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'rgba(0,0,0,.20)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
          {label}
        </span>
        <i className={`fas ${icon}`} style={{ color, fontSize: 12 }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}
