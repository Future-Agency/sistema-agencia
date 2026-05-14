'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'

type Props = {
  cliente: Cliente
  canEdit: boolean
  onUpdate: () => void
}

/**
 * Card editable inline para la estrategia general del cliente.
 * Una sola URL que persiste entre todos los loops.
 */
export default function EstrategiaCard({ cliente, canEdit, onUpdate }: Props) {
  const [value, setValue] = useState(cliente.estrategia_url ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setValue(cliente.estrategia_url ?? '') }, [cliente.estrategia_url])

  const looksLikeUrl = (s: string) => {
    const t = s.trim()
    return t.startsWith('http://') || t.startsWith('https://')
  }

  const save = async () => {
    setSaving(true)
    await supabase.from('clientes').update({
      estrategia_url: value.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', cliente.id)
    setSaving(false)
    setEditing(false)
    onUpdate()
  }

  const isFilled = !!cliente.estrategia_url

  return (
    <div style={{
      marginBottom: 16, padding: '12px 14px',
      background: isFilled
        ? 'linear-gradient(135deg, rgba(167,139,250,.10) 0%, rgba(167,139,250,.04) 100%)'
        : 'rgba(245,166,35,.05)',
      border: `1px solid ${isFilled ? 'rgba(167,139,250,.30)' : 'rgba(245,166,35,.30)'}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: isFilled ? '#a78bfa' : '#f5a623', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
              Estrategia general del cliente
              <span style={{ marginLeft: 6, fontSize: 9, color: '#6a6a80', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>
                · única, persiste entre ciclos
              </span>
            </div>
            {!editing && (
              isFilled ? (
                <a href={cliente.estrategia_url!} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: '#e8e8f0', marginTop: 2, display: 'block', textDecoration: 'none', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                  <i className="fas fa-link" style={{ marginRight: 6, color: '#a78bfa' }} />
                  Abrir estrategia
                </a>
              ) : (
                <div style={{ fontSize: 12, color: '#f5a623', marginTop: 2, fontStyle: 'italic' as const }}>
                  Sin cargar — bloquea el inicio de scripts del primer ciclo
                </div>
              )
            )}
          </div>
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600,
              background: 'transparent', border: `1px solid ${isFilled ? 'rgba(167,139,250,.55)' : 'rgba(245,166,35,.55)'}`,
              color: isFilled ? '#a78bfa' : '#f5a623', borderRadius: 4, cursor: 'pointer',
            }}>
            <i className="fas fa-pen" style={{ marginRight: 4 }} />
            {isFilled ? 'Cambiar' : 'Cargar'}
          </button>
        )}
      </div>

      {editing && (
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            placeholder="https://docs.google.com/..."
            style={{
              width: '100%', padding: '8px 11px',
              background: '#0a0a0f',
              border: `1px solid ${value && !looksLikeUrl(value) ? '#f5365c' : looksLikeUrl(value) ? '#a78bfa' : '#2a2a40'}`,
              borderRadius: 6, color: '#e8e8f0', fontSize: 13,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => { setValue(cliente.estrategia_url ?? ''); setEditing(false) }} disabled={saving}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid #2a2a40', color: '#a0a0b8', borderRadius: 4, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving || (!!value && !looksLikeUrl(value))}
              style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: '#a78bfa', color: '#0a0a0f', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
