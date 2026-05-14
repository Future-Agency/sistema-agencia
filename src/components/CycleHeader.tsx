'use client'
import { useMemo } from 'react'
import type { Cliente } from '@/lib/supabase'

type Props = {
  clientes: Cliente[]
  /** Mes calendario actual (YYYY-MM). v2 usaremos ciclo_mes de la tabla. */
  cycleLabel?: string
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

export default function CycleHeader({ clientes, cycleLabel }: Props) {
  const label = cycleLabel ?? defaultCycleLabel()

  const stats = useMemo(() => {
    const total = clientes.length
    const completaron = clientes.filter(c => c.estado === ESTADO_CIERRE || c.estado === ESTADO_CIERRE_LEGACY).length
    const enDeployment = clientes.filter(c => ESTADOS_DEPLOYMENT.has(c.estado)).length
    const enProduccion = total - enDeployment
    const pct = total > 0 ? Math.round((completaron / total) * 100) : 0
    const onboarding = clientes.filter(c => c.is_onboarding).length
    return { total, completaron, enProduccion, enDeployment, pct, onboarding }
  }, [clientes])

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
      </div>
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
