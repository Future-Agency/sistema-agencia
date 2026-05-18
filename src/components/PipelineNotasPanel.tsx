'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase, type PipelineNota, type PipelineNotaArea, type PipelineNotaTipo } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'
import { cicloMesLabel } from '@/lib/cycles'

type Props = {
  agenciaId: string
  area: PipelineNotaArea
  cicloMes: string
  currentUser: CurrentUser
  onClose: () => void
}

const TIPOS: { value: PipelineNotaTipo; label: string; icon: string; color: string }[] = [
  { value: 'nota',       label: 'Nota',        icon: '📝', color: '#5e72e4' },
  { value: 'falla',      label: 'Falla',       icon: '⚠️', color: '#f5365c' },
  { value: 'correccion', label: 'Corrección',  icon: '🔧', color: '#f5a623' },
  { value: 'mejora',     label: 'Mejora',      icon: '💡', color: '#00d97e' },
]

export default function PipelineNotasPanel({ agenciaId, area, cicloMes, currentUser, onClose }: Props) {
  const [notas, setNotas] = useState<PipelineNota[]>([])
  const [loading, setLoading] = useState(true)
  const [nuevoTipo, setNuevoTipo] = useState<PipelineNotaTipo>('nota')
  const [nuevoTexto, setNuevoTexto] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pipeline_notas')
      .select('*')
      .eq('agencia_id', agenciaId)
      .eq('area', area)
      .eq('ciclo_mes', cicloMes)
      .order('created_at', { ascending: false })
    setNotas((data ?? []) as PipelineNota[])
    setLoading(false)
  }, [agenciaId, area, cicloMes])

  useEffect(() => { load() }, [load])

  const agregar = async () => {
    if (!nuevoTexto.trim()) return
    setSaving(true)
    await supabase.from('pipeline_notas').insert({
      agencia_id: agenciaId, area, ciclo_mes: cicloMes,
      tipo: nuevoTipo, texto: nuevoTexto.trim(),
      autor: currentUser.name,
    })
    setNuevoTexto('')
    setSaving(false)
    load()
  }

  const eliminar = async (id: number) => {
    if (!window.confirm('Eliminar esta nota?')) return
    await supabase.from('pipeline_notas').delete().eq('id', id)
    load()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed' as const, inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,.5)', display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420, height: '100%', background: '#12121a',
        borderLeft: '1px solid #2a2a40', overflowY: 'auto' as const,
        display: 'flex', flexDirection: 'column' as const,
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #2a2a40', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
              📒 Notas · {area === 'general' ? 'General' : area}
            </h3>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2, textTransform: 'capitalize' as const }}>
              Ciclo {cicloMesLabel(cicloMes)}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#a0a0b8',
            fontSize: 20, cursor: 'pointer', padding: 4,
          }}>×</button>
        </div>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2a40', background: '#0f0f15' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {TIPOS.map(t => (
              <button key={t.value} onClick={() => setNuevoTipo(t.value)}
                style={{
                  flex: 1, padding: '6px 4px', borderRadius: 5,
                  background: nuevoTipo === t.value ? `${t.color}22` : 'transparent',
                  border: `1px solid ${nuevoTipo === t.value ? t.color : '#2a2a40'}`,
                  color: nuevoTipo === t.value ? t.color : '#a0a0b8',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                }}>{t.icon} {t.label}</button>
            ))}
          </div>
          <textarea value={nuevoTexto} onChange={e => setNuevoTexto(e.target.value)}
            placeholder="Describí la nota / falla / corrección / mejora…"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box' as const,
              padding: '8px 10px', borderRadius: 6,
              background: '#0a0a0f', border: '1px solid #2a2a40',
              color: '#e8e8f0', fontSize: 12, fontFamily: 'inherit',
              resize: 'vertical' as const, marginBottom: 8,
            }} />
          <button onClick={agregar} disabled={saving || !nuevoTexto.trim()}
            style={{
              width: '100%', padding: '8px', borderRadius: 6,
              background: nuevoTexto.trim() ? '#5e72e4' : '#2a2a40',
              border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: nuevoTexto.trim() ? 'pointer' : 'not-allowed',
            }}>{saving ? 'Guardando…' : '+ Agregar nota'}</button>
        </div>

        <div style={{ flex: 1, padding: '14px 18px', overflowY: 'auto' as const }}>
          {loading ? (
            <div style={{ textAlign: 'center' as const, color: '#6a6a80', padding: 20, fontSize: 12 }}>Cargando…</div>
          ) : notas.length === 0 ? (
            <div style={{ textAlign: 'center' as const, color: '#6a6a80', padding: 30, fontSize: 12 }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>
              Sin notas todavía en este ciclo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {notas.map(n => {
                const tipoMeta = TIPOS.find(t => t.value === n.tipo) ?? TIPOS[0]
                return (
                  <div key={n.id} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: '#1a1a28',
                    borderLeft: `3px solid ${tipoMeta.color}`,
                    border: '1px solid #2a2a40',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: tipoMeta.color,
                        textTransform: 'uppercase' as const, letterSpacing: 0.4,
                      }}>{tipoMeta.icon} {tipoMeta.label}</span>
                      <button onClick={() => eliminar(n.id)} style={{
                        background: 'transparent', border: 'none', color: '#6a6a80',
                        fontSize: 10, cursor: 'pointer',
                      }}>✕</button>
                    </div>
                    <div style={{ fontSize: 12, color: '#e8e8f0', lineHeight: 1.5, marginBottom: 4 }}>
                      {n.texto}
                    </div>
                    <div style={{ fontSize: 9, color: '#6a6a80' }}>
                      {n.autor ?? 'Anónimo'} · {new Date(n.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
