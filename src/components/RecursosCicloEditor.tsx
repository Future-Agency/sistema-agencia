'use client'
import { useEffect, useState } from 'react'
import type { ClienteCicloRecursos } from '@/lib/supabase'
import { queryRecursosCiclo, upsertRecursosCiclo } from '@/lib/piezas'
import { cicloMesLabel } from '@/lib/cycles'

type Props = {
  agenciaId: string
  clienteId: number
  cicloMes: string
  canEdit: boolean
}

type LinkField = {
  key: keyof ClienteCicloRecursos
  label: string
  icon: string
  area: 'preflight' | 'copys' | 'grab' | 'edit' | 'diseno' | 'subida' | 'reporte'
  placeholder: string
}

// Pre-flight per-ciclo (la estrategia vive a NIVEL CLIENTE, no acá)
const PREFLIGHT_FIELDS: LinkField[] = [
  { key: 'analisis_metricas_url', label: 'Análisis métricas previas',    icon: '📊', area: 'preflight', placeholder: 'Link al análisis del ciclo anterior' },
  { key: 'productos_excel_url',   label: 'Excel de productos',           icon: '📦', area: 'preflight', placeholder: 'Link al excel con productos del loop' },
]

const LINK_FIELDS: LinkField[] = [
  { key: 'drive_scripts_url',          label: 'Scripts del mes',         icon: '📝', area: 'copys',  placeholder: 'Drive con los N guiones' },
  { key: 'drive_videos_crudos_url',    label: 'Material crudo',          icon: '🎥', area: 'grab',   placeholder: 'Drive con grabaciones sin editar' },
  { key: 'drive_videos_editados_url',  label: 'Videos editados',         icon: '✂️', area: 'edit',   placeholder: 'Drive con videos finales' },
  { key: 'drive_portadas_url',         label: 'Portadas',                icon: '🖼️', area: 'diseno', placeholder: 'Drive con las portadas' },
  { key: 'drive_carrouseles_url',      label: 'Carrouseles',             icon: '🎠', area: 'diseno', placeholder: 'Drive con carrouseles' },
  { key: 'drive_historias_url',        label: 'Historias',               icon: '📱', area: 'diseno', placeholder: 'Drive con secuencias de stories' },
  { key: 'metricool_url',              label: 'Metricool (programación)', icon: '🚀', area: 'subida', placeholder: 'app.metricool.com/...' },
  { key: 'reporte_url',                label: 'Reporte del mes',         icon: '📊', area: 'reporte', placeholder: 'Drive con el reporte mensual' },
]

const ALL_LINK_FIELDS = [...PREFLIGHT_FIELDS, ...LINK_FIELDS]

const AREA_COLORS: Record<string, string> = {
  preflight: '#f5a623',
  copys: '#5e72e4',
  grab: '#f5a623',
  edit: '#fb6340',
  diseno: '#ec4ad8',
  subida: '#00d97e',
  reporte: '#a0a0b8',
}

export default function RecursosCicloEditor({ agenciaId, clienteId, cicloMes, canEdit }: Props) {
  const [recursos, setRecursos] = useState<ClienteCicloRecursos | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<ClienteCicloRecursos>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const r = await queryRecursosCiclo(clienteId, cicloMes)
    setRecursos(r)
    setForm(r ?? {})
    setLoading(false)
  }

  useEffect(() => { load() }, [clienteId, cicloMes])

  const filledCount = ALL_LINK_FIELDS.filter(f => recursos?.[f.key]).length
  const totalCount = ALL_LINK_FIELDS.length
  const preflightMissing = PREFLIGHT_FIELDS.filter(f => !recursos?.[f.key]).length

  const save = async () => {
    setSaving(true); setError(null)
    const cleanData: Partial<ClienteCicloRecursos> = {}
    ALL_LINK_FIELDS.forEach(f => {
      const v = (form[f.key] as string | undefined)?.trim()
      cleanData[f.key] = (v || null) as never
    })
    cleanData.notas = (form.notas as string | undefined)?.trim() || null
    cleanData.notas_material = (form.notas_material as string | undefined)?.trim() || null
    const res = await upsertRecursosCiclo({ agenciaId, clienteId, cicloMes, data: cleanData })
    setSaving(false)
    if (!res.ok) { setError(res.error || 'Error al guardar'); return }
    setEditing(false)
    load()
  }

  if (loading) {
    return <div style={{ padding: 14, fontSize: 12, color: '#6a6a80' }}>Cargando recursos…</div>
  }

  return (
    <div style={{
      marginBottom: 16, padding: 14,
      background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#a0b4f5', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>
            <i className="fas fa-folder-open" style={{ marginRight: 6 }} />
            Recursos del ciclo
          </div>
          <div style={{ fontSize: 12, color: '#6a6a80', marginTop: 2 }}>
            {cicloMesLabel(cicloMes)} · <strong style={{ color: filledCount > 0 ? '#00d97e' : '#6a6a80' }}>{filledCount}/{totalCount}</strong> links cargados
            {preflightMissing > 0 && (
              <span style={{ marginLeft: 8, color: '#f5a623', fontWeight: 700 }}>
                · faltan {preflightMissing} pre-flight
              </span>
            )}
          </div>
        </div>
        {canEdit && !editing && (
          <button onClick={() => { setForm(recursos ?? {}); setEditing(true) }}
            style={btnSecondary}>
            <i className="fas fa-pen" style={{ marginRight: 6 }} />Editar
          </button>
        )}
      </div>

      {editing ? (
        <div>
          {/* Pre-flight section */}
          <div style={{
            marginBottom: 12, padding: 10,
            background: 'rgba(245,166,35,.06)', border: '1px solid rgba(245,166,35,.30)',
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#f5a623',
              textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 8,
            }}>
              ⚠️ Pre-guionización · requerido antes de empezar scripts
              <span style={{ marginLeft: 6, fontSize: 9, color: '#6a6a80', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>
                · la estrategia general se carga a nivel cliente
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
              {PREFLIGHT_FIELDS.map(f => {
                const value = (form[f.key] as string) || ''
                return (
                  <div key={f.key}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#f5a623', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 4 }}>
                      <span>{f.icon}</span> {f.label}
                    </label>
                    <input value={value}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value as never })}
                      placeholder={f.placeholder}
                      style={{ width: '100%', padding: '6px 10px', background: '#0a0a0f', border: '1px solid rgba(245,166,35,.30)', borderRadius: 5, color: '#e8e8f0', fontSize: 11, outline: 'none' }} />
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ fontSize: 10, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>
            Carpetas Drive por área (se cargan automáticamente al cerrar cada etapa)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {LINK_FIELDS.map(f => {
              const value = (form[f.key] as string) || ''
              return (
                <div key={f.key}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, color: AREA_COLORS[f.area], fontWeight: 700,
                    textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4,
                  }}>
                    <span>{f.icon}</span> {f.label}
                  </label>
                  <input
                    value={value}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value as never })}
                    placeholder={f.placeholder}
                    style={{
                      width: '100%', padding: '7px 10px',
                      background: '#0a0a0f', border: `1px solid ${AREA_COLORS[f.area]}33`,
                      borderRadius: 6, color: '#e8e8f0', fontSize: 12, outline: 'none',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: '#f5a623', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4, display: 'block' }}>
              🎥 Observaciones sobre el material crudo
              <span style={{ marginLeft: 6, color: '#6a6a80', fontSize: 9, fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>
                (lo que dejó quien grabó / quien recibió el material)
              </span>
            </label>
            <textarea
              value={(form.notas_material as string) || ''}
              onChange={e => setForm({ ...form, notas_material: e.target.value })}
              rows={2}
              placeholder="ej: faltó cubrir el ángulo del producto; la luz del video 4 quedó oscura; recordar B-roll para el reel 7…"
              style={{
                width: '100%', padding: '7px 10px',
                background: '#0a0a0f', border: '1px solid rgba(245,166,35,.30)',
                borderRadius: 6, color: '#e8e8f0', fontSize: 12, outline: 'none',
                fontFamily: 'inherit', resize: 'vertical' as const,
              }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4, display: 'block' }}>Notas generales del ciclo</label>
            <textarea
              value={(form.notas as string) || ''}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              rows={2}
              placeholder="Notas / contexto / decisiones del mes…"
              style={{
                width: '100%', padding: '7px 10px',
                background: '#0a0a0f', border: '1px solid #2a2a40',
                borderRadius: 6, color: '#e8e8f0', fontSize: 12, outline: 'none',
                fontFamily: 'inherit', resize: 'vertical' as const,
              }}
            />
          </div>
          {error && (
            <div style={{
              marginTop: 8, padding: '6px 10px',
              background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
              borderRadius: 6, color: '#f5365c', fontSize: 11, fontWeight: 600,
            }}>
              <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => { setEditing(false); setForm(recursos ?? {}) }} disabled={saving} style={btnSecondary}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving} style={btnPrimary}>
              {saving ? 'Guardando…' : 'Guardar links'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {ALL_LINK_FIELDS.map(f => {
            const value = recursos?.[f.key] as string | null | undefined
            const filled = !!value
            return (
              <a
                key={f.key}
                href={filled ? value : undefined}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  background: filled ? AREA_COLORS[f.area] + '12' : '#12121a',
                  border: `1px solid ${filled ? AREA_COLORS[f.area] + '44' : '#2a2a40'}`,
                  borderRadius: 6,
                  color: filled ? '#e8e8f0' : '#4a4a60',
                  fontSize: 12,
                  textDecoration: 'none',
                  cursor: filled ? 'pointer' : 'default',
                }}
                onClick={e => { if (!filled) e.preventDefault() }}
              >
                <span style={{ fontSize: 14 }}>{f.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: AREA_COLORS[f.area], fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 11, color: filled ? '#e8e8f0' : '#4a4a60', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                    {filled ? '🔗 abrir' : 'Sin cargar'}
                  </div>
                </div>
              </a>
            )
          })}
          {recursos?.notas_material && (
            <div style={{
              gridColumn: '1 / -1', marginTop: 4,
              padding: '8px 12px', borderRadius: 6,
              background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.30)',
              fontSize: 11, color: '#e8e8f0', lineHeight: 1.5,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#f5a623', textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4 }}>
                🎥 Observaciones del material crudo
              </div>
              {recursos.notas_material}
            </div>
          )}
          {recursos?.notas && (
            <div style={{
              gridColumn: '1 / -1', marginTop: 4,
              padding: '6px 10px', borderRadius: 6,
              background: '#12121a', border: '1px dashed #2a2a40',
              fontSize: 11, color: '#a0a0b8',
            }}>
              <i className="fas fa-note-sticky" style={{ marginRight: 6, color: '#6a6a80' }} />
              {recursos.notas}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '7px 14px', background: '#5e72e4', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', border: '1px solid #2a2a40',
  color: '#a0a0b8', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
}
