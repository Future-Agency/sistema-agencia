'use client'
import { useMemo, useState } from 'react'
import type { Cliente, Equipo, LoopSeccion, LoopReasonCategory } from '@/lib/supabase'
import { logLoop, calcLoopCost, currentCicloMes, SECCION_LABELS, REASON_CATEGORY_LABELS } from '@/lib/loopLog'
import type { CurrentUser } from '@/lib/users'

type Props = {
  agenciaId: string
  currentUser: CurrentUser
  clientes: Cliente[]
  equipo: Equipo[]
  onClose: () => void
  onSaved: () => void
  /** Pre-fill */
  defaultClienteId?: number
  defaultSeccion?: LoopSeccion
  defaultResponsable?: string
}

const SECCIONES: LoopSeccion[] = ['copys', 'grab', 'edit', 'diseno', 'subida']
const REASONS: LoopReasonCategory[] = ['cliente_cambio_idea', 'error_interno', 'aprobacion_owner', 'otro']

export default function LogLoopModal({
  agenciaId, currentUser, clientes, equipo, onClose, onSaved,
  defaultClienteId, defaultSeccion, defaultResponsable,
}: Props) {
  const [clienteId, setClienteId] = useState<number | ''>(defaultClienteId ?? '')
  const [seccion, setSeccion] = useState<LoopSeccion>(defaultSeccion ?? 'edit')
  const [stagesBack, setStagesBack] = useState(1)
  const [fromState, setFromState] = useState('')
  const [toState, setToState] = useState('CORRECCIÓN')
  const [reasonCategory, setReasonCategory] = useState<LoopReasonCategory>('cliente_cambio_idea')
  const [reason, setReason] = useState('')
  const [responsable, setResponsable] = useState(defaultResponsable ?? currentUser.name)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cost = useMemo(() => calcLoopCost({ seccion, stagesBack }), [seccion, stagesBack])
  const cliente = clienteId ? clientes.find(c => c.id === clienteId) : null

  const handleSubmit = async () => {
    setError(null)
    if (!clienteId) {
      setError('Elegí un cliente')
      return
    }
    if (!reason.trim()) {
      setError('Escribí la razón del loop')
      return
    }
    setSubmitting(true)
    const res = await logLoop({
      agenciaId,
      clienteId: Number(clienteId),
      seccion,
      fromState: fromState || null,
      toState: toState || null,
      stagesBack,
      cicloMes: currentCicloMes(),
      responsable,
      reason: reason.trim(),
      reasonCategory,
      loggedBy: currentUser.name,
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error || 'Error al guardar el loop')
      return
    }
    onSaved()
  }

  const responsableOptions = useMemo(() => {
    // Lista única de nombres conocidos: equipo + currentUser
    const set = new Set<string>([currentUser.name])
    equipo.forEach(e => set.add(e.nombre))
    return Array.from(set).sort()
  }, [equipo, currentUser.name])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: '#12121a',
          border: '1px solid #2a2a40',
          borderRadius: 14,
          padding: '22px 24px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#fff' }}>
              <i className="fas fa-rotate" style={{ color: '#f5365c', marginRight: 8 }} />
              Registrar loop
            </h3>
            <p style={{ fontSize: 11, color: '#6a6a80', margin: 0, marginTop: 2 }}>
              Una corrección que retrocedió etapas y costó tiempo extra
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#6a6a80',
            fontSize: 18, cursor: 'pointer', padding: 4,
          }}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Cliente */}
        <Field label="Cliente">
          <select
            value={clienteId}
            onChange={e => setClienteId(e.target.value ? Number(e.target.value) : '')}
            style={selectStyle}
          >
            <option value="">— Seleccionar cliente —</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </Field>

        {/* Sección */}
        <Field label="Sección">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {SECCIONES.map(s => {
              const meta = SECCION_LABELS[s]
              const active = seccion === s
              return (
                <button
                  key={s}
                  onClick={() => setSeccion(s)}
                  style={{
                    padding: '8px 4px',
                    background: active ? meta.color + '22' : '#1a1a28',
                    border: `1px solid ${active ? meta.color : '#2a2a40'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    color: active ? meta.color : '#a0a0b8',
                    fontSize: 11, fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{meta.icon}</div>
                  {meta.label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Stages back */}
        <Field label={`Etapas perdidas: ${stagesBack}`}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setStagesBack(n)}
                style={{
                  flex: 1, padding: '8px 0',
                  background: stagesBack === n ? '#5e72e4' : '#1a1a28',
                  border: `1px solid ${stagesBack === n ? '#5e72e4' : '#2a2a40'}`,
                  borderRadius: 6,
                  color: stagesBack === n ? '#fff' : '#a0a0b8',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        {/* From / To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Desde">
            <input type="text" value={fromState} onChange={e => setFromState(e.target.value)} placeholder="REVISIÓN CLIENTE" style={inputStyle} />
          </Field>
          <Field label="Hasta">
            <input type="text" value={toState} onChange={e => setToState(e.target.value)} placeholder="CORRECCIÓN" style={inputStyle} />
          </Field>
        </div>

        {/* Razón */}
        <Field label="Categoría">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReasonCategory(r)}
                style={{
                  padding: '8px 10px',
                  background: reasonCategory === r ? '#22223a' : '#1a1a28',
                  border: `1px solid ${reasonCategory === r ? '#5e72e4' : '#2a2a40'}`,
                  borderRadius: 6,
                  color: reasonCategory === r ? '#fff' : '#a0a0b8',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {REASON_CATEGORY_LABELS[r]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Razón (texto libre)">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Owner pidió cambiar paleta de colores…"
            rows={2}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' as const }}
          />
        </Field>

        {/* Responsable */}
        <Field label="Responsable del loop">
          <select value={responsable} onChange={e => setResponsable(e.target.value)} style={selectStyle}>
            {responsableOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>

        {/* Cost preview */}
        <div style={{
          padding: '10px 14px',
          background: 'rgba(245,54,92,.08)',
          border: '1px solid rgba(245,54,92,.20)',
          borderRadius: 8,
          margin: '10px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: '#a0a0b8' }}>
            <i className="fas fa-coins" style={{ marginRight: 6, color: '#f5365c' }} />
            Costo estimado del loop
          </span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#f5365c' }}>
            ${cost.toFixed(2)}
            <span style={{ fontSize: 10, color: '#6a6a80', marginLeft: 4 }}>USD</span>
          </span>
        </div>

        {/* Cliente preview */}
        {cliente && (
          <div style={{ fontSize: 11, color: '#6a6a80', marginBottom: 12 }}>
            <i className="fas fa-info-circle" style={{ marginRight: 4 }} />
            {cliente.nombre} actualmente en estado <strong>{cliente.estado || '—'}</strong>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(245,54,92,.10)',
            border: '1px solid rgba(245,54,92,.25)',
            borderRadius: 6,
            color: '#f5365c',
            fontSize: 12, fontWeight: 600,
            marginBottom: 12,
          }}>
            <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} disabled={submitting}
            style={{ ...btnStyle, background: 'transparent', border: '1px solid #2a2a40', color: '#a0a0b8' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting || !clienteId || !reason.trim()}
            style={{ ...btnStyle, background: '#f5365c', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Guardando…' : <><i className="fas fa-rotate" style={{ marginRight: 6 }} />Registrar loop</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: '#1a1a28', border: '1px solid #2a2a40',
  borderRadius: 6, color: '#e8e8f0', fontSize: 13,
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const btnStyle: React.CSSProperties = {
  padding: '8px 18px',
  border: 'none', borderRadius: 6,
  fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
}
