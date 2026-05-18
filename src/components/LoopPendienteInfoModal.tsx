'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import { cicloMesLabel } from '@/lib/cycles'
import { MOTIVOS_PENDIENTE_INFO, type MotivoPendiente } from '@/lib/areaStates'

type Batch = {
  cliente: Cliente
  cicloMes: string
}

type Props = {
  agenciaId: string
  batch: Batch
  onClose: () => void
  /** Llamado tras guardar exitosamente los motivos. */
  onConfirm: () => void | Promise<void>
}

/**
 * Modal que aparece cuando un batch entra al estado PENDIENTE DE INFORMACIÓN
 * (pipeline Copys). Permite seleccionar uno o varios motivos del catálogo +
 * texto libre para OTRO. Guarda en cliente_ciclo_recursos.pendiente_info_*.
 */
export default function LoopPendienteInfoModal({ agenciaId, batch, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<MotivoPendiente>>(new Set())
  const [otroText, setOtroText] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pre-cargar motivos existentes (para edición posterior)
  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('cliente_ciclo_recursos')
        .select('pendiente_info_motivos, pendiente_info_otro')
        .eq('cliente_id', batch.cliente.id)
        .eq('ciclo_mes', batch.cicloMes)
        .maybeSingle()
      if (cancel) return
      const motivos = (data?.pendiente_info_motivos ?? []) as string[]
      setSelected(new Set(motivos.filter(m =>
        MOTIVOS_PENDIENTE_INFO.some(o => o.value === m)
      ) as MotivoPendiente[]))
      setOtroText(data?.pendiente_info_otro ?? '')
      setLoading(false)
    })()
    return () => { cancel = true }
  }, [batch.cliente.id, batch.cicloMes])

  const toggle = (v: MotivoPendiente) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  const canConfirm = selected.size > 0 && !(selected.has('OTRO') && otroText.trim().length === 0)

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    const payload = {
      agencia_id: agenciaId,
      cliente_id: batch.cliente.id,
      ciclo_mes: batch.cicloMes,
      pendiente_info_motivos: Array.from(selected),
      pendiente_info_otro: selected.has('OTRO') ? otroText.trim() : null,
      pendiente_info_no_aplica: false,
      updated_at: new Date().toISOString(),
    }
    const { error: e } = await supabase
      .from('cliente_ciclo_recursos')
      .upsert(payload, { onConflict: 'cliente_id,ciclo_mes' })
    setSaving(false)
    if (e) {
      // Si la columna no existe, mostrá un mensaje claro
      if (/pendiente_info/i.test(e.message)) {
        setError('Falta aplicar la migration sql/2026-05-17_pendiente_info_copys.sql en Supabase.')
      } else {
        setError(e.message)
      }
      return
    }
    await onConfirm()
  }

  return (
    <div style={{
      position: 'fixed' as const, inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a28', border: '1px solid #2a2a40', borderRadius: 12,
        maxWidth: 500, width: '100%', padding: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>⏸️</span>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f5a623' }}>
            Pendiente de información
          </h2>
        </div>
        <div style={{ fontSize: 12, color: '#a0a0b8', marginBottom: 16 }}>
          <strong>{batch.cliente.nombre}</strong> · ciclo {cicloMesLabel(batch.cicloMes)}
          <br />¿Qué info estamos esperando para arrancar?
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6a6a80', fontSize: 12 }}>
            Cargando…
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {MOTIVOS_PENDIENTE_INFO.map(opt => {
                const isOn = selected.has(opt.value)
                return (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 6,
                    background: isOn ? 'rgba(245,166,35,.10)' : '#0f0f15',
                    border: `1px solid ${isOn ? '#f5a623' : '#2a2a40'}`,
                    cursor: 'pointer', fontSize: 12, color: '#e8e8f0',
                  }}>
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggle(opt.value)}
                      style={{ accentColor: '#f5a623' }}
                    />
                    {opt.label}
                  </label>
                )
              })}
            </div>

            {selected.has('OTRO') && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#6a6a80', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
                  Especificar
                </label>
                <textarea
                  value={otroText}
                  onChange={e => setOtroText(e.target.value)}
                  placeholder="¿Qué info estamos esperando?"
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box' as const,
                    padding: '8px 10px', borderRadius: 6,
                    background: '#0f0f15', border: '1px solid #2a2a40',
                    color: '#e8e8f0', fontSize: 12, fontFamily: 'inherit',
                    resize: 'vertical' as const,
                  }}
                />
              </div>
            )}

            {error && (
              <div style={{
                marginBottom: 12, padding: '8px 10px', borderRadius: 6,
                background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.3)',
                color: '#f5365c', fontSize: 11,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  background: 'transparent', border: '1px solid #2a2a40',
                  color: '#a0a0b8', padding: '8px 14px', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >Cancelar</button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || saving}
                style={{
                  background: canConfirm ? '#f5a623' : '#3a3a55',
                  border: 'none', color: canConfirm ? '#1a1a28' : '#6a6a80',
                  padding: '8px 14px', borderRadius: 6,
                  fontSize: 12, fontWeight: 700,
                  cursor: canConfirm ? 'pointer' : 'not-allowed',
                  opacity: saving ? 0.7 : 1,
                }}
              >{saving ? 'Guardando…' : 'Marcar pendiente'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
