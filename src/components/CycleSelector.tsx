'use client'
import { useMemo, useState } from 'react'
import type { Cliente } from '@/lib/supabase'
import { currentCicloMes, cicloMesLabel, listCyclesInUse, type CicloMes } from '@/lib/cycles'

type Props = {
  clientes: Cliente[]
  value: CicloMes | null  // null = todos
  onChange: (v: CicloMes | null) => void
  /** Mostrar etiqueta compacta */
  compact?: boolean
}

export default function CycleSelector({ clientes, value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false)
  const current = currentCicloMes()
  const cyclesInUse = useMemo(() => listCyclesInUse(clientes), [clientes])

  const allOptions = useMemo(() => {
    const arr = [...cyclesInUse]
    if (!arr.includes(current)) arr.unshift(current)
    return arr
  }, [cyclesInUse, current])

  const label = value === null ? 'Todos los ciclos' : cicloMesLabel(value)
  const isActive = value !== null

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Cambiar ciclo activo"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: isActive ? 'rgba(94,114,228,.15)' : '#1a1a28',
          border: `1px solid ${isActive ? '#5e72e4' : '#2a2a40'}`,
          borderRadius: 8, padding: '6px 10px',
          color: isActive ? '#a0b4f5' : '#a0a0b8',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
          textTransform: 'capitalize' as const,
        }}
      >
        <i className="fas fa-sync-alt" style={{ fontSize: 10 }} />
        {compact ? cicloMesLabel(value || current).split(' ')[0] : label}
        <i className="fas fa-chevron-down" style={{ fontSize: 9, color: '#6a6a80' }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 6,
            background: '#1a1a28', border: '1px solid #2a2a40',
            borderRadius: 10, padding: 6, minWidth: 220, zIndex: 51,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          }}>
            <div style={{
              padding: '6px 10px', fontSize: 10, color: '#6a6a80',
              fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4,
            }}>
              Ciclos
            </div>
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              style={pickStyle(value === null)}
            >
              <i className="fas fa-globe" style={{ marginRight: 8, color: '#6a6a80' }} />
              Todos los ciclos
            </button>
            {allOptions.map(c => {
              const isCurrent = c === current
              return (
                <button
                  key={c}
                  onClick={() => { onChange(c); setOpen(false) }}
                  style={pickStyle(value === c)}
                >
                  <span style={{ flex: 1, textAlign: 'left' as const, textTransform: 'capitalize' as const }}>
                    {cicloMesLabel(c)}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      background: 'rgba(0,217,126,.15)', color: '#00d97e',
                      fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3,
                    }}>
                      Actual
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function pickStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center',
    padding: '8px 10px', borderRadius: 6,
    background: active ? '#22223a' : 'transparent',
    border: 'none', color: '#e8e8f0',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    textAlign: 'left' as const,
    textTransform: 'capitalize' as const,
  }
}
