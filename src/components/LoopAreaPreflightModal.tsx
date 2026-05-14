'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type ClienteCicloRecursos } from '@/lib/supabase'
import type { UserArea } from '@/lib/users'
import { cicloMesLabel } from '@/lib/cycles'
import { getPreflightGate, isPreflightFieldValid, type PreflightField } from '@/lib/areaPreflightGates'
import { AREA_DEFS } from '@/lib/areaStates'

type Batch = {
  cliente: Cliente
  cicloMes: string
  piezas: { id: number }[]
}

type Props = {
  agenciaId: string
  area: UserArea
  batch: Batch
  fromState: string
  toState: string
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

function fieldPlaceholderHint(f: PreflightField): string {
  return f.type === 'date' ? 'Seleccioná fecha' : f.placeholder
}

function normalizeDateForInput(v: string): string {
  // Acepta ISO completo y devuelve YYYY-MM-DD para <input type="date">
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/**
 * Modal de gate pre-transición.
 * Aparece cuando una transición tiene preflight definido (ej: copys MÉT→SCRIPT).
 * Permite editar inline cada campo (algunos van a cliente, otros a cliente_ciclo_recursos).
 * Si todos los campos quedan completos, el onConfirm se habilita.
 */
export default function LoopAreaPreflightModal({ agenciaId, area, batch, fromState, toState, onClose, onConfirm }: Props) {
  const gate = useMemo(() => getPreflightGate(area, fromState, toState), [area, fromState, toState])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-cargar valores actuales de cliente + recursos
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('clientes').select('*').eq('id', batch.cliente.id).single(),
      supabase.from('cliente_ciclo_recursos').select('*')
        .eq('cliente_id', batch.cliente.id).eq('ciclo_mes', batch.cicloMes).maybeSingle(),
    ]).then(([cliRes, recRes]) => {
      if (cancelled) return
      const cli = (cliRes.data ?? null) as Cliente | null
      const rec = (recRes.data ?? null) as ClienteCicloRecursos | null
      // Pre-fill values
      const initial: Record<string, string> = {}
      gate?.fields.forEach(f => {
        const v = f.source === 'cliente'
          ? (cli as Record<string, unknown> | null)?.[f.field]
          : (rec as Record<string, unknown> | null)?.[f.field]
        if (typeof v === 'string') {
          initial[f.field] = f.type === 'date' ? normalizeDateForInput(v) : v
        }
      })
      setValues(initial)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [batch.cliente.id, batch.cicloMes, gate])

  const allFilled = gate?.fields.every(f => isPreflightFieldValid(f, values[f.field] || '')) ?? false
  const missingCount = gate?.fields.filter(f => !isPreflightFieldValid(f, values[f.field] || '')).length ?? 0

  const save = async () => {
    if (!gate || !allFilled) return
    setSaving(true); setError(null)
    // Separar updates por tabla
    const clienteUpdates: Record<string, unknown> = {}
    const recursosUpdates: Record<string, unknown> = {}
    gate.fields.forEach(f => {
      const v = values[f.field]?.trim() || null
      if (f.source === 'cliente') clienteUpdates[f.field] = v
      else recursosUpdates[f.field] = v
    })

    let firstError: { message: string } | null = null
    if (Object.keys(clienteUpdates).length > 0) {
      clienteUpdates.updated_at = new Date().toISOString()
      const { error: cliErr } = await supabase
        .from('clientes')
        .update(clienteUpdates)
        .eq('id', batch.cliente.id)
      if (cliErr) firstError = cliErr
    }
    if (!firstError && Object.keys(recursosUpdates).length > 0) {
      const { error: recErr } = await supabase
        .from('cliente_ciclo_recursos')
        .upsert({
          agencia_id: agenciaId,
          cliente_id: batch.cliente.id,
          ciclo_mes: batch.cicloMes,
          ...recursosUpdates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cliente_id,ciclo_mes' })
      if (recErr) firstError = recErr
    }

    setSaving(false)
    if (firstError) {
      setError(firstError.message)
      return
    }
    await onConfirm()
  }

  if (!gate) return null

  return (
    <div onClick={onClose} style={backdrop}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            {AREA_DEFS[area]?.emoji ?? '🛂'} {AREA_DEFS[area]?.label.toUpperCase() ?? area.toUpperCase()} · {cicloMesLabel(batch.cicloMes)}
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, marginTop: 4, color: '#fff' }}>
            {gate.title}
          </h3>
          <p style={{ fontSize: 12, color: '#a0a0b8', margin: 0, marginTop: 4, lineHeight: 1.5 }}>
            <strong>{batch.cliente.nombre}</strong> pasaría de <strong style={{ color: '#a78bfa' }}>{fromState}</strong> a <strong style={{ color: '#a78bfa' }}>{toState}</strong>.
            {' '}{gate.description}
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center' as const, color: '#6a6a80', fontSize: 12 }}>Cargando…</div>
        ) : (
          <div style={{
            padding: 12, marginBottom: 14,
            background: missingCount > 0 ? 'rgba(245,54,92,.05)' : 'rgba(0,217,126,.06)',
            border: `1px solid ${missingCount > 0 ? 'rgba(245,54,92,.25)' : 'rgba(0,217,126,.25)'}`,
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, marginBottom: 10,
              color: missingCount > 0 ? '#f5365c' : '#00d97e',
              textTransform: 'uppercase' as const, letterSpacing: 0.4,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className={`fas ${missingCount > 0 ? 'fa-triangle-exclamation' : 'fa-check-circle'}`} />
              {missingCount > 0 ? `Falta${missingCount > 1 ? 'n' : ''} ${missingCount} de ${gate.fields.length}` : 'Todos los requisitos cargados'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {gate.fields.map(f => {
                const value = values[f.field] || ''
                const isOk = isPreflightFieldValid(f, value)
                const inputType = f.type === 'date' ? 'date' : 'text'
                return (
                  <div key={f.field}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 10, color: isOk ? '#00d97e' : '#a0a0b8', fontWeight: 600,
                      marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.3,
                    }}>
                      <span>{f.icon}</span> {f.label}
                      {f.source === 'cliente' && (
                        <span style={{
                          marginLeft: 4, fontSize: 8, padding: '1px 5px', borderRadius: 3,
                          background: 'rgba(94,114,228,.15)', color: '#5e72e4', fontWeight: 700,
                        }}>
                          NIVEL CLIENTE
                        </span>
                      )}
                      {isOk && <i className="fas fa-check" style={{ marginLeft: 'auto', color: '#00d97e' }} />}
                    </label>
                    <input
                      type={inputType}
                      value={value}
                      onChange={e => setValues({ ...values, [f.field]: e.target.value })}
                      placeholder={fieldPlaceholderHint(f)}
                      style={{
                        width: '100%', padding: '8px 11px',
                        background: '#0a0a0f',
                        border: `1px solid ${value && !isOk ? '#f5365c' : isOk ? 'rgba(0,217,126,.40)' : '#2a2a40'}`,
                        borderRadius: 5, color: '#e8e8f0', fontSize: 12,
                        outline: 'none', fontFamily: 'inherit',
                        colorScheme: 'dark' as const,
                      }}
                    />
                    {f.helper && (
                      <div style={{ fontSize: 9, color: '#6a6a80', marginTop: 3, lineHeight: 1.4 }}>
                        {f.helper}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, marginBottom: 10,
            background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
            color: '#f5365c', fontSize: 12, fontWeight: 600,
          }}>
            <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={btnSecondary}>Cancelar</button>
          <button onClick={save} disabled={!allFilled || saving || loading}
            style={{
              padding: '9px 18px', background: '#a78bfa', color: '#0a0a0f',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
              opacity: !allFilled || saving || loading ? 0.5 : 1,
              cursor: !allFilled || saving || loading ? 'not-allowed' : 'pointer',
            }}>
            {saving ? 'Guardando…' : <><i className="fas fa-check" style={{ marginRight: 6 }} />Guardar y continuar</>}
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
  width: '100%', maxWidth: 540,
  background: '#12121a', border: '1px solid #2a2a40',
  borderRadius: 14, padding: '22px 24px',
  maxHeight: '90vh', overflowY: 'auto' as const,
}

const btnSecondary: React.CSSProperties = {
  padding: '9px 16px', background: 'transparent',
  border: '1px solid #2a2a40', color: '#a0a0b8',
  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
