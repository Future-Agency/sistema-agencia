'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'
import { cicloMesLabel } from '@/lib/cycles'

type Batch = {
  cliente: Cliente
  cicloMes: string
  piezas: { id: number }[]
}

type Props = {
  agenciaId: string
  batch: Batch
  toState: string
  currentUser: CurrentUser
  onClose: () => void
  onConfirm: (data: { driveUrl: string; notasMaterial: string }) => void | Promise<void>
}

export default function LoopGrabUploadModal({ batch, toState, onClose, onConfirm }: Props) {
  const [driveUrl, setDriveUrl] = useState('')
  const [notasMaterial, setNotasMaterial] = useState('')
  const [existing, setExisting] = useState<{ drive?: string; notas?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pre-cargar lo que ya hay en recursos del ciclo (si existe)
  useEffect(() => {
    supabase
      .from('cliente_ciclo_recursos')
      .select('drive_videos_crudos_url, notas_material')
      .eq('cliente_id', batch.cliente.id)
      .eq('ciclo_mes', batch.cicloMes)
      .maybeSingle()
      .then(({ data }) => {
        const dr = data?.drive_videos_crudos_url ?? null
        const nt = data?.notas_material ?? null
        if (dr) setDriveUrl(dr)
        if (nt) setNotasMaterial(nt)
        setExisting({ drive: dr ?? undefined, notas: nt ?? undefined })
      })
  }, [batch.cliente.id, batch.cicloMes])

  const looksLikeUrl = (s: string) => {
    const t = s.trim()
    return t.startsWith('http://') || t.startsWith('https://')
  }
  const canSubmit = looksLikeUrl(driveUrl)

  const handleConfirm = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    await onConfirm({ driveUrl: driveUrl.trim(), notasMaterial: notasMaterial.trim() })
    setSubmitting(false)
  }

  return (
    <div onClick={onClose} style={backdrop}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            🎥 GRABACIÓN · {cicloMesLabel(batch.cicloMes)}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginTop: 4, color: '#fff' }}>
            Cerrar grabación de {batch.cliente.nombre}
          </h3>
          <p style={{ fontSize: 12, color: '#a0a0b8', margin: 0, marginTop: 4, lineHeight: 1.4 }}>
            Vas a marcar las <strong>{batch.piezas.length} piezas</strong> de este loop como <strong style={{ color: '#00d97e' }}>{toState}</strong>.
            Para cerrar la etapa hace falta el link del Drive con el material crudo.
          </p>
        </div>

        {/* Drive URL */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#00d97e', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>
            <i className="fas fa-link" />
            Drive link del material crudo
            <span style={{ color: '#f5365c' }}>*</span>
            {existing?.drive && (
              <span style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,217,126,.15)', color: '#00d97e', fontWeight: 600 }}>
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
              border: `1px solid ${driveUrl && !canSubmit ? '#f5365c' : canSubmit ? '#00d97e' : '#2a2a40'}`,
              borderRadius: 6, color: '#e8e8f0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ marginTop: 6, fontSize: 10, color: '#6a6a80', lineHeight: 1.4 }}>
            Se guarda en <strong style={{ color: '#a0a0b8' }}>Recursos del ciclo → Material crudo</strong>.
          </div>
        </div>

        {/* Observaciones */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>
            <i className="fas fa-message" />
            Observaciones / sugerencias sobre el material
            <span style={{ fontSize: 9, color: '#6a6a80', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>(opcional)</span>
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
            Lo van a ver el editor y diseñador cuando abran el cliente.
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={submitting} style={btnSecondary}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!canSubmit || submitting} style={{ ...btnPrimary, opacity: !canSubmit || submitting ? 0.5 : 1, cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Guardando…' : <><i className="fas fa-check" style={{ marginRight: 6 }} />Confirmar material subido</>}
          </button>
        </div>
      </div>
    </div>
  )
}

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20, overflow: 'auto' as const,
}

const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 520,
  background: '#12121a', border: '1px solid #2a2a40',
  borderRadius: 14, padding: '22px 24px',
  maxHeight: '90vh', overflowY: 'auto' as const,
}

const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', background: '#00d97e', color: '#0a0a0f',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '9px 16px', background: 'transparent',
  border: '1px solid #2a2a40', color: '#a0a0b8',
  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
