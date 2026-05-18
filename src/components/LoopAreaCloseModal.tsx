'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase, type Cliente, type ClienteCicloRecursos } from '@/lib/supabase'
import type { CurrentUser, UserArea } from '@/lib/users'
import { AREA_CLOSE_CONFIG, missingPreflight, type PreflightLink } from '@/lib/areaClose'
import { cicloMesLabel } from '@/lib/cycles'

type Batch = {
  cliente: Cliente
  cicloMes: string
  piezas: { id: number }[]
}

type Props = {
  agenciaId: string
  area: UserArea
  batch: Batch
  toState: string
  currentUser: CurrentUser
  onClose: () => void
  onConfirm: (data: {
    linkUrl: string
    comment: string
    preflightFields?: Record<string, string>
    closeDate: string
  }) => void | Promise<void>
}

function looksLikeUrl(s: string): boolean {
  const t = s.trim()
  return t.startsWith('http://') || t.startsWith('https://')
}

/** Valida un valor según el tipo del preflight field. */
function isPreflightFieldOk(p: PreflightLink, value: string): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  switch (p.type) {
    case 'number': {
      const n = Number(v)
      return Number.isFinite(n) && n >= 0
    }
    case 'date':
      return !isNaN(new Date(v).getTime())
    case 'url':
    default:
      return looksLikeUrl(v)
  }
}

export default function LoopAreaCloseModal({ agenciaId: _ag, area, batch, toState, onClose, onConfirm }: Props) {
  const cfg = AREA_CLOSE_CONFIG[area]
  const [linkUrl, setLinkUrl] = useState('')
  const [comment, setComment] = useState('')
  const [preflightValues, setPreflightValues] = useState<Record<string, string>>({})
  const [existing, setExisting] = useState<Partial<ClienteCicloRecursos> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pre-cargar lo que ya hay en recursos del ciclo
  useEffect(() => {
    supabase
      .from('cliente_ciclo_recursos')
      .select('*')
      .eq('cliente_id', batch.cliente.id)
      .eq('ciclo_mes', batch.cicloMes)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const rec = data as ClienteCicloRecursos
        setExisting(rec)
        const linkVal = rec[cfg.linkField] as string | null
        if (linkVal) setLinkUrl(linkVal)
        const commentVal = rec[cfg.commentField] as string | null
        if (commentVal) setComment(commentVal)
        const pre: Record<string, string> = {}
        cfg.preflight.forEach(p => {
          const v = rec[p.field]
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            pre[p.field as string] = String(v)
          }
        })
        setPreflightValues(pre)
      })
  }, [batch.cliente.id, batch.cicloMes, area, cfg.linkField, cfg.commentField, cfg.preflight])

  const linkOk = looksLikeUrl(linkUrl)
  const preflightOk = useMemo(() => {
    if (cfg.preflight.length === 0) return true
    return cfg.preflight.every(p => isPreflightFieldOk(p, preflightValues[p.field as string] || ''))
  }, [preflightValues, cfg.preflight])
  const canSubmit = linkOk && preflightOk

  const missingCount = useMemo(() => {
    if (cfg.preflight.length === 0) return 0
    return cfg.preflight.filter(p => !isPreflightFieldOk(p, preflightValues[p.field as string] || '')).length
  }, [preflightValues, cfg.preflight])

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    await onConfirm({
      linkUrl: linkUrl.trim(),
      comment: comment.trim(),
      preflightFields: cfg.preflight.length > 0 ? Object.fromEntries(
        cfg.preflight.map(p => [p.field as string, (preflightValues[p.field as string] || '').trim()])
      ) : undefined,
      closeDate: new Date().toISOString(),
    })
    setSubmitting(false)
  }

  return (
    <div onClick={onClose} style={backdrop}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6a6a80', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            {cfg.emoji} {area.toUpperCase()} · {cicloMesLabel(batch.cicloMes)}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, marginTop: 4, color: '#fff' }}>
            Cerrar {area} de {batch.cliente.nombre}
          </h3>
          <p style={{ fontSize: 12, color: '#a0a0b8', margin: 0, marginTop: 4, lineHeight: 1.5 }}>
            Vas a marcar las <strong>{batch.piezas.length} piezas</strong> como{' '}
            <strong style={{ color: cfg.color }}>{toState}</strong>. {cfg.description}
          </p>
        </div>

        {/* Pre-flight (only for copys currently) */}
        {cfg.preflight.length > 0 && (
          <div style={{
            marginBottom: 16, padding: 12,
            background: missingCount > 0 ? 'rgba(245,54,92,.06)' : 'rgba(0,217,126,.06)',
            border: `1px solid ${missingCount > 0 ? 'rgba(245,54,92,.25)' : 'rgba(0,217,126,.25)'}`,
            borderRadius: 8,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: missingCount > 0 ? '#f5365c' : '#00d97e',
              textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className={`fas ${missingCount > 0 ? 'fa-triangle-exclamation' : 'fa-check-circle'}`} />
              Requisitos pre-grabación
              {missingCount > 0 && <span style={{ fontWeight: 500, opacity: 0.8 }}>· falta{missingCount > 1 ? 'n' : ''} {missingCount}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {cfg.preflight.map(p => {
                const value = preflightValues[p.field as string] || ''
                const isOk = isPreflightFieldOk(p, value)
                const inputType = p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'
                return (
                  <div key={p.field as string}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 10, color: isOk ? '#00d97e' : '#a0a0b8', fontWeight: 600,
                      marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.3,
                    }}>
                      <span>{p.icon}</span> {p.label}
                      {isOk && <i className="fas fa-check" style={{ marginLeft: 'auto', color: '#00d97e' }} />}
                    </label>
                    <input
                      type={inputType}
                      value={value}
                      min={p.type === 'number' ? 0 : undefined}
                      onChange={e => setPreflightValues({ ...preflightValues, [p.field as string]: e.target.value })}
                      placeholder={p.placeholder}
                      style={{
                        width: '100%', padding: '7px 10px',
                        background: '#0a0a0f',
                        border: `1px solid ${value && !isOk ? '#f5365c' : isOk ? 'rgba(0,217,126,.40)' : '#2a2a40'}`,
                        borderRadius: 5, color: '#e8e8f0', fontSize: 12,
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    {p.helper && (
                      <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 3, lineHeight: 1.4 }}>
                        {p.helper}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Main link */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: cfg.color, fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6,
          }}>
            <i className="fas fa-link" />
            {cfg.linkLabel}
            <span style={{ color: '#f5365c' }}>*</span>
            {existing && existing[cfg.linkField] && (
              <span style={{
                marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: `${cfg.color}22`, color: cfg.color, fontWeight: 600,
              }}>
                pre-cargado
              </span>
            )}
          </label>
          <input
            type="text"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder={cfg.linkPlaceholder}
            autoFocus={cfg.preflight.length === 0}
            style={{
              width: '100%', padding: '9px 12px',
              background: '#0a0a0f',
              border: `1px solid ${linkUrl && !linkOk ? '#f5365c' : linkOk ? cfg.color : '#2a2a40'}`,
              borderRadius: 6, color: '#e8e8f0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ marginTop: 6, fontSize: 10, color: '#6a6a80', lineHeight: 1.4 }}>
            {cfg.linkHelper}
          </div>
        </div>

        {/* Optional comment */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: '#a78bfa', fontWeight: 700,
            textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6,
          }}>
            <i className="fas fa-message" />
            Observaciones / sugerencias
            <span style={{ fontSize: 9, color: '#6a6a80', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>
              (opcional · lo va a ver quien siga)
            </span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder={cfg.commentPlaceholder}
            style={{
              width: '100%', padding: '8px 12px',
              background: '#0a0a0f', border: '1px solid #2a2a40',
              borderRadius: 6, color: '#e8e8f0', fontSize: 12, lineHeight: 1.4,
              outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const,
            }}
          />
        </div>

        {/* Auto-recorded info */}
        <div style={{
          padding: '8px 12px', borderRadius: 6,
          background: 'rgba(94,114,228,.06)', border: '1px solid rgba(94,114,228,.20)',
          fontSize: 10, color: '#a0b4f5', marginBottom: 14,
        }}>
          <i className="fas fa-clock" style={{ marginRight: 6 }} />
          Se va a registrar la fecha de cierre automáticamente para alimentar deadlines posteriores.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting} style={btnSecondary}>Cancelar</button>
          <button onClick={handleSubmit} disabled={!canSubmit || submitting}
            style={{
              padding: '9px 18px', background: cfg.color, color: '#0a0a0f',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
              opacity: !canSubmit || submitting ? 0.5 : 1,
              cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? 'Guardando…' : <><i className="fas fa-check" style={{ marginRight: 6 }} />Cerrar {area}</>}
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

export { missingPreflight }
