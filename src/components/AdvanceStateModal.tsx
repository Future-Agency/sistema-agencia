'use client'
import { useMemo, useState, useEffect } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import type { CurrentUser, UserArea } from '@/lib/users'
import { AREA_DEFS, getStateById, getPrereqs } from '@/lib/areaStates'
import { logLoop } from '@/lib/loopLog'
import { currentCicloMes, nextCicloMes } from '@/lib/cycles'

type Props = {
  agenciaId: string
  currentUser: CurrentUser
  cliente: Cliente
  area: UserArea
  /** Si null, intenta avanzar +1; si presente, va directo a ese estado (o retroceder) */
  targetStateId?: number
  /** Si true, este modal es de corrección (registrará un loop) */
  isCorrection?: boolean
  onClose: () => void
  onSaved: () => void
}

export default function AdvanceStateModal({
  agenciaId, currentUser, cliente, area, targetStateId, isCorrection, onClose, onSaved,
}: Props) {
  const def = AREA_DEFS[area]
  const isOnb = !!cliente.is_onboarding
  const stateList = isOnb && def.onboardingStates ? def.onboardingStates : def.states

  // Current state from cliente row
  const currentValue = (cliente as Record<string, unknown>)[def.clienteColumn] as string | number | null | undefined
  const currentId = useMemo(() => {
    if (typeof currentValue === 'number') return currentValue
    if (typeof currentValue === 'string' && currentValue.length > 0) {
      const found = stateList.find(s => s.label === currentValue)
      return found ? found.id : 0
    }
    return 0
  }, [currentValue, stateList])

  const targetId = targetStateId ?? Math.min(currentId + 1, stateList[stateList.length - 1].id)
  const isRetro = targetId < currentId

  const fromState = getStateById(def, currentId, isOnb)
  const toState = getStateById(def, targetId, isOnb)

  const prereqs = useMemo(() => getPrereqs(area, currentId, targetId), [area, currentId, targetId])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Special case: grab → MATERIAL SUBIDO requires Drive URL
  const cicloMes = cliente.ciclo_mes ?? currentCicloMes()
  const requiresDriveUrl = area === 'grab' && targetId === def.approvedStateId && !isRetro
  const [driveUrl, setDriveUrl] = useState('')
  const [existingDriveUrl, setExistingDriveUrl] = useState<string | null>(null)
  const [notasMaterial, setNotasMaterial] = useState('')

  // Pre-cargar el drive_videos_crudos_url + notas_material existentes del ciclo (si hay)
  useEffect(() => {
    if (!requiresDriveUrl) return
    supabase
      .from('cliente_ciclo_recursos')
      .select('drive_videos_crudos_url, notas_material')
      .eq('cliente_id', cliente.id)
      .eq('ciclo_mes', cicloMes)
      .maybeSingle()
      .then(({ data }) => {
        const existing = data?.drive_videos_crudos_url ?? null
        setExistingDriveUrl(existing)
        if (existing) setDriveUrl(existing)
        const existingNotas = data?.notas_material ?? null
        if (existingNotas) setNotasMaterial(existingNotas)
      })
  }, [requiresDriveUrl, cliente.id, cicloMes])

  function looksLikeUrl(s: string): boolean {
    const t = s.trim()
    return t.startsWith('http://') || t.startsWith('https://')
  }

  const allPrereqsOk = prereqs.every((_, i) => checked.has(i)) || prereqs.length === 0
  const reasonRequired = isCorrection || isRetro
  const driveOk = !requiresDriveUrl || looksLikeUrl(driveUrl)
  const canSubmit = allPrereqsOk && (!reasonRequired || reason.trim().length > 0) && driveOk

  const handleSubmit = async () => {
    if (!toState) return
    setSubmitting(true)
    setError(null)

    // Update payload base
    const update: Record<string, unknown> = {
      [def.clienteColumn]: toState.label,
      estado_changed_at: new Date().toISOString(),
    }

    // Si cierra el ciclo (subida → APROBADO/MÉTRICAS), pasar al próximo ciclo
    // y resetear todos los estados de área para empezar de cero.
    const isCycleClose = area === 'subida' && targetId === def.approvedStateId
    if (isCycleClose) {
      const current = cliente.ciclo_mes ?? currentCicloMes()
      update.ciclo_mes = nextCicloMes(current)
      update.estado_copys = ''
      update.estado_grab = ''
      update.estado_edicion = ''
      update.estado_diseno = ''
      update.estado_subida = ''
    }

    const { error: e } = await supabase
      .from('clientes')
      .update(update)
      .eq('id', cliente.id)

    if (e) {
      setError(e.message)
      setSubmitting(false)
      return
    }

    // Guardar el Drive URL + notas_material en recursos del ciclo si es transición grab→MATERIAL SUBIDO
    if (requiresDriveUrl && driveUrl.trim()) {
      const { error: eRec } = await supabase
        .from('cliente_ciclo_recursos')
        .upsert({
          agencia_id: agenciaId,
          cliente_id: cliente.id,
          ciclo_mes: cicloMes,
          drive_videos_crudos_url: driveUrl.trim(),
          notas_material: notasMaterial.trim() || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cliente_id,ciclo_mes' })
      if (eRec) {
        setError(`Estado guardado, pero el Drive link no se pudo guardar: ${eRec.message}`)
        setSubmitting(false)
        return
      }
    }

    // Si es retroceso o corrección → registrar loop
    if (isRetro || isCorrection) {
      const stagesBack = Math.max(1, currentId - targetId)
      await logLoop({
        agenciaId,
        clienteId: cliente.id,
        seccion: area,
        fromState: fromState?.label ?? null,
        toState: toState.label,
        stagesBack,
        cicloMes: cliente.ciclo_mes ?? currentCicloMes(),
        responsable: currentUser.name,
        reason: reason.trim() || (isCorrection ? 'Corrección' : 'Retroceso'),
        reasonCategory: isCorrection ? 'cliente_cambio_idea' : 'otro',
        loggedBy: currentUser.name,
      })
    }

    setSubmitting(false)
    onSaved()
  }

  if (!toState) {
    return (
      <Backdrop onClose={onClose}>
        <div style={modalBox}>
          <h3 style={{ margin: 0, color: '#fff' }}>Sin estado destino</h3>
          <p style={{ color: '#6a6a80', fontSize: 12, marginTop: 8 }}>
            El cliente ya está en el último estado del área.
          </p>
          <button onClick={onClose} style={btnPrimary}>Cerrar</button>
        </div>
      </Backdrop>
    )
  }

  const accent = isCorrection || isRetro ? '#f5365c' : def.primaryColor

  return (
    <Backdrop onClose={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.6, marginBottom: 4 }}>
              {def.emoji} {def.label} · {cliente.nombre}
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#fff' }}>
              {isCorrection ? '🔄 Mandar a corrección' : isRetro ? '↩ Retroceder' : 'Avanzar etapa'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6a6a80', fontSize: 18, cursor: 'pointer' }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Transition visual */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center',
          padding: 14, background: '#1a1a28', borderRadius: 8, marginBottom: 14,
        }}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: 10, color: '#6a6a80', marginBottom: 4 }}>DESDE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#a0a0b8' }}>
              {fromState?.icon} {fromState?.label || '—'}
            </div>
          </div>
          <i className="fas fa-arrow-right" style={{ color: accent, fontSize: 18 }} />
          <div style={{ textAlign: 'center' as const }}>
            <div style={{ fontSize: 10, color: '#6a6a80', marginBottom: 4 }}>HASTA</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>
              {toState.icon} {toState.label}
            </div>
          </div>
        </div>

        {/* Prereqs checklist */}
        {prereqs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 8 }}>
              <i className="fas fa-list-check" style={{ marginRight: 6 }} />
              Prerequisitos
            </div>
            {prereqs.map((p, i) => {
              const isChecked = checked.has(i)
              return (
                <button
                  key={i}
                  onClick={() => {
                    const next = new Set(checked)
                    if (isChecked) next.delete(i); else next.add(i)
                    setChecked(next)
                  }}
                  style={{
                    width: '100%', textAlign: 'left' as const,
                    padding: '10px 12px',
                    background: isChecked ? 'rgba(0,217,126,.10)' : '#1a1a28',
                    border: `1px solid ${isChecked ? '#00d97e' : '#2a2a40'}`,
                    borderRadius: 6, marginBottom: 6,
                    color: '#e8e8f0', fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <i
                    className={`fas ${isChecked ? 'fa-square-check' : 'fa-square'}`}
                    style={{ color: isChecked ? '#00d97e' : '#6a6a80', fontSize: 14 }}
                  />
                  <span>{p}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Drive URL — REQUERIDO al pasar grab → MATERIAL SUBIDO */}
        {requiresDriveUrl && (
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#00d97e', fontWeight: 700,
              textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6,
            }}>
              <i className="fas fa-link" />
              Drive link del material crudo
              <span style={{ color: '#f5365c' }}>*</span>
              {existingDriveUrl && (
                <span style={{
                  marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  background: 'rgba(0,217,126,.15)', color: '#00d97e', fontWeight: 600,
                }}>
                  pre-cargado del ciclo
                </span>
              )}
            </label>
            <input
              type="text"
              value={driveUrl}
              onChange={e => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              autoFocus
              style={{
                width: '100%', padding: '9px 12px',
                background: '#0a0a0f',
                border: `1px solid ${driveUrl && !driveOk ? '#f5365c' : looksLikeUrl(driveUrl) ? '#00d97e' : '#2a2a40'}`,
                borderRadius: 6, color: '#e8e8f0', fontSize: 13,
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ marginTop: 6, fontSize: 10, color: '#6a6a80', lineHeight: 1.4 }}>
              Sin este link no podés cerrar la etapa. El link se guarda en{' '}
              <strong style={{ color: '#a0a0b8' }}>Recursos del ciclo → Material crudo</strong>{' '}
              del ciclo <strong style={{ color: '#a0b4f5', textTransform: 'capitalize' as const }}>
                {cicloMes.replace('-', ' ')}
              </strong>.
            </div>

            {/* Observaciones / sugerencias sobre el material — opcional */}
            <div style={{ marginTop: 10 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: '#a78bfa', fontWeight: 700,
                textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6,
              }}>
                <i className="fas fa-message" />
                Observaciones / sugerencias sobre el material
                <span style={{ fontSize: 9, color: '#6a6a80', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>
                  (opcional)
                </span>
              </label>
              <textarea
                value={notasMaterial}
                onChange={e => setNotasMaterial(e.target.value)}
                rows={3}
                placeholder="ej: faltó cubrir el ángulo del producto; la luz del video 4 quedó oscura; recordar B-roll para el reel 7…"
                style={{
                  width: '100%', padding: '8px 12px',
                  background: '#0a0a0f', border: '1px solid #2a2a40',
                  borderRadius: 6, color: '#e8e8f0', fontSize: 12, lineHeight: 1.4,
                  outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const,
                }}
              />
              <div style={{ marginTop: 4, fontSize: 10, color: '#6a6a80' }}>
                Queda guardado en el ciclo. Lo va a ver quien siga editando / diseñando.
              </div>
            </div>
          </div>
        )}

        {/* Reason (siempre, pero requerido para corrección/retro) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>
            {reasonRequired ? 'Razón ' : 'Nota '}
            {reasonRequired && <span style={{ color: '#f5365c' }}>*</span>}
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder={isCorrection ? 'Cliente pidió cambiar la paleta…' : isRetro ? 'Por qué retrocedemos' : 'Nota opcional para el log'}
            style={{
              width: '100%', padding: '8px 10px',
              background: '#1a1a28', border: '1px solid #2a2a40',
              borderRadius: 6, color: '#e8e8f0', fontSize: 13,
              outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Cost preview if loop */}
        {(isCorrection || isRetro) && (
          <div style={{
            padding: '8px 12px', borderRadius: 6,
            background: 'rgba(245,54,92,.08)',
            border: '1px solid rgba(245,54,92,.20)',
            fontSize: 11, color: '#a0a0b8', marginBottom: 14,
          }}>
            <i className="fas fa-rotate" style={{ color: '#f5365c', marginRight: 6 }} />
            Esta acción registrará un loop a tu nombre ({currentUser.name}).
          </div>
        )}

        {/* Cycle close warning */}
        {area === 'subida' && targetId === def.approvedStateId && (
          <div style={{
            padding: '8px 12px', borderRadius: 6,
            background: 'rgba(0,217,126,.10)',
            border: '1px solid rgba(0,217,126,.25)',
            fontSize: 11, color: '#a0d8a0', marginBottom: 14,
          }}>
            <i className="fas fa-rotate-right" style={{ color: '#00d97e', marginRight: 6 }} />
            <strong>Cierre de ciclo:</strong> al confirmar, este cliente entra al próximo ciclo
            <strong> ({nextCicloMes(cliente.ciclo_mes ?? currentCicloMes())})</strong> con todos sus estados de área reseteados.
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(245,54,92,.10)',
            border: '1px solid rgba(245,54,92,.25)',
            borderRadius: 6, color: '#f5365c',
            fontSize: 12, fontWeight: 600, marginBottom: 12,
          }}>
            <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting}
            style={{ ...btnSecondary }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting || !canSubmit}
            style={{
              ...btnPrimary,
              background: accent,
              opacity: !canSubmit || submitting ? 0.5 : 1,
              cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Guardando…' : isCorrection ? 'Mandar a corrección' : isRetro ? 'Retroceder' : 'Avanzar'}
          </button>
        </div>
      </div>
    </Backdrop>
  )
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {children}
    </div>
  )
}

const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: '#12121a', border: '1px solid #2a2a40',
  borderRadius: 14, padding: '22px 24px',
  maxHeight: '90vh', overflowY: 'auto' as const,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: '#5e72e4', color: '#fff',
  border: 'none', borderRadius: 6,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent',
  border: '1px solid #2a2a40', color: '#a0a0b8',
  borderRadius: 6, fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}
