'use client'
import { useState, useEffect } from 'react'
import { cicloMesLabel, type CicloMes } from '@/lib/cycles'

type Props = {
  open: boolean
  fromCiclo: CicloMes
  toCiclo: CicloMes
  clientesAfectados: number
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

const FRASE_CONFIRMACION = 'NUEVO CICLO'

/**
 * Modal de confirmación pesada para "Iniciar nuevo ciclo".
 * Esta acción mueve TODOS los clientes activos al ciclo siguiente y resetea sus
 * estados de área. Como es masiva e irreversible, requiere que el usuario tipee
 * la frase "NUEVO CICLO" antes de habilitar el botón rojo.
 */
export default function ConfirmNuevoCicloModal({
  open, fromCiclo, toCiclo, clientesAfectados, onCancel, onConfirm,
}: Props) {
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (open) { setText(''); setRunning(false) }
  }, [open])

  if (!open) return null

  const canConfirm = text.trim().toUpperCase() === FRASE_CONFIRMACION && !running

  const handleConfirm = async () => {
    if (!canConfirm) return
    setRunning(true)
    try { await onConfirm() } finally { setRunning(false) }
  }

  return (
    <div onClick={onCancel} style={backdrop}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#fff' }}>
            Iniciar nuevo ciclo
          </h3>
        </div>

        <p style={{ fontSize: 13, color: '#a0a0b8', margin: 0, marginBottom: 14, lineHeight: 1.5 }}>
          Vas a mover el ciclo de <strong style={{ color: '#a78bfa' }}>{cicloMesLabel(fromCiclo)}</strong>
          {' → '}<strong style={{ color: '#00d97e' }}>{cicloMesLabel(toCiclo)}</strong>.
        </p>

        <div style={{
          padding: 12, marginBottom: 14, borderRadius: 8,
          background: 'rgba(245,54,92,.08)', border: '1px solid rgba(245,54,92,.30)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f5365c', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
            <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
            Esto va a hacer en <strong>{clientesAfectados}</strong> cliente{clientesAfectados === 1 ? '' : 's'} activo{clientesAfectados === 1 ? '' : 's'}:
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#e8e8f0', lineHeight: 1.7 }}>
            <li>Setear su <code>ciclo_mes</code> a <strong>{toCiclo}</strong>.</li>
            <li>Resetear los estados de <strong>Copys / Grab / Edición / Diseño / Subida</strong> al primero.</li>
            <li>El ciclo anterior queda en el histórico (las piezas no se borran).</li>
          </ul>
          <div style={{ fontSize: 11, color: '#f5a623', marginTop: 8, fontWeight: 600 }}>
            <i className="fas fa-circle-info" style={{ marginRight: 4 }} />
            Es una acción masiva. No se puede deshacer con un click.
          </div>
        </div>

        <label style={{ display: 'block', fontSize: 11, color: '#a0a0b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.3 }}>
          Para confirmar, escribí <code style={{ color: '#f5365c', fontWeight: 800, background: 'rgba(245,54,92,.10)', padding: '1px 5px', borderRadius: 3 }}>{FRASE_CONFIRMACION}</code>
        </label>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={FRASE_CONFIRMACION}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%', padding: '10px 12px',
            background: '#0a0a0f',
            border: `1px solid ${canConfirm ? 'rgba(0,217,126,.55)' : '#2a2a40'}`,
            borderRadius: 6, color: '#e8e8f0', fontSize: 14,
            fontFamily: 'monospace', letterSpacing: 1,
            outline: 'none', marginBottom: 16,
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={running} style={btnSecondary}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            style={{
              padding: '10px 18px',
              background: canConfirm ? '#f5365c' : '#2a2a40',
              color: canConfirm ? '#fff' : '#6a6a80',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}>
            {running ? 'Iniciando…' : <><i className="fas fa-rotate-right" style={{ marginRight: 6 }} />Iniciar ciclo {toCiclo}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300,
  background: 'rgba(0,0,0,.70)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, overflow: 'auto' as const,
}

const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 520,
  background: '#12121a', border: '1px solid #2a2a40',
  borderRadius: 14, padding: '22px 24px',
  maxHeight: '90vh', overflowY: 'auto' as const,
}

const btnSecondary: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent',
  border: '1px solid #2a2a40', color: '#a0a0b8',
  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
