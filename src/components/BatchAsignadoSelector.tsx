'use client'
import { useMemo, useState } from 'react'
import { supabase, type Equipo, type Pieza } from '@/lib/supabase'
import type { UserArea } from '@/lib/users'

/** Mapping área → campo en `piezas` para asignación. Áreas sin campo no muestran selector. */
export const AREA_TO_PIEZA_FIELD: Partial<Record<UserArea, keyof Pieza>> = {
  copys:  'copywriter_id',
  edit:   'editor_id',
  diseno: 'disenador_id',
  subida: 'cm_id',
}

/** Mapping área → rol del equipo (para filtrar el dropdown). */
export const AREA_TO_ROL: Partial<Record<UserArea, Equipo['rol']>> = {
  copys:  'copy',
  edit:   'editor',
  diseno: 'diseñador',
  subida: 'cm',
}

type Props = {
  area: UserArea
  piezasIds: number[]      // todas las piezas del batch a actualizar
  asignadoIdActual: string | null  // el id asignado dominante (si todas comparten); null si mixto / nadie
  equipo: Equipo[]
  disabled?: boolean
  onAsignado?: () => void  // callback tras update OK (para refrescar la pipeline)
}

export default function BatchAsignadoSelector({ area, piezasIds, asignadoIdActual, equipo, disabled, onAsignado }: Props) {
  const field = AREA_TO_PIEZA_FIELD[area]
  const rol = AREA_TO_ROL[area]
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const opciones = useMemo(() => {
    if (!rol) return []
    return equipo.filter(e => e.rol === rol && e.activo)
  }, [equipo, rol])

  if (!field || !rol || opciones.length === 0) return null  // área no asignable

  const asignado = asignadoIdActual ? equipo.find(e => e.id === asignadoIdActual) ?? null : null

  const asignar = async (equipoId: string | null) => {
    if (saving) return
    setSaving(true)
    setOpen(false)
    await supabase.from('piezas')
      .update({ [field as string]: equipoId, updated_at: new Date().toISOString() })
      .in('id', piezasIds)
    setSaving(false)
    onAsignado?.()
  }

  return (
    <div style={{ position: 'relative' as const, display: 'inline-flex' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        disabled={disabled || saving}
        title={asignado ? `Asignado: ${asignado.nombre}` : 'Sin asignar — click para asignar'}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: asignado ? '2px 7px 2px 2px' : '2px 6px',
          borderRadius: 999,
          background: asignado ? `${asignado.color}18` : 'transparent',
          border: `1px solid ${asignado ? `${asignado.color}55` : '#3a3a55'}`,
          color: asignado ? asignado.color : '#6a6a80',
          fontSize: 10, fontWeight: 700, cursor: 'pointer',
          opacity: saving ? 0.5 : 1,
        }}
      >
        {asignado ? (
          <>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: asignado.color, color: '#0a0a0f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 800,
            }}>
              {asignado.nombre[0]?.toUpperCase()}
            </span>
            <span>{asignado.nombre.split(' ')[0]}</span>
          </>
        ) : (
          <span style={{ padding: '0 2px' }}>+ asignar</span>
        )}
      </button>
      {open && (
        <>
          <div
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            style={{ position: 'fixed' as const, inset: 0, zIndex: 60 }}
          />
          <div style={{
            position: 'absolute' as const, top: '100%', left: 0, marginTop: 4,
            background: '#1a1a28', border: '1px solid #2a2a40',
            borderRadius: 6, padding: 4, minWidth: 160, zIndex: 61,
            boxShadow: '0 4px 16px rgba(0,0,0,.4)',
          }}>
            <div style={{
              padding: '4px 8px', fontSize: 9, color: '#6a6a80',
              fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4,
            }}>Asignar a</div>
            {asignado && (
              <button
                onClick={(e) => { e.stopPropagation(); asignar(null) }}
                style={menuItemStyle('#6a6a80')}
              >
                ✕ Quitar asignación
              </button>
            )}
            {opciones.map(opt => {
              const isCurrent = opt.id === asignadoIdActual
              return (
                <button
                  key={opt.id}
                  onClick={(e) => { e.stopPropagation(); asignar(opt.id) }}
                  disabled={isCurrent}
                  style={{ ...menuItemStyle(opt.color), opacity: isCurrent ? 0.5 : 1 }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: opt.color, color: '#0a0a0f',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, marginRight: 6,
                  }}>{opt.nombre[0]?.toUpperCase()}</span>
                  {opt.nombre}{isCurrent && ' ✓'}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function menuItemStyle(color: string): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center',
    padding: '6px 8px', borderRadius: 4,
    background: 'transparent', border: 'none',
    color: '#e8e8f0', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', textAlign: 'left' as const,
  }
}
