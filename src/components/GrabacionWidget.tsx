'use client'
import { useEffect, useState } from 'react'
import { supabase, type ClienteCicloRecursos } from '@/lib/supabase'

type Props = {
  agenciaId: string
  clienteId: number
  cicloMes: string
  canEdit: boolean
}

/**
 * Widget compacto para gestionar:
 *  - fecha tentativa de grabación
 *  - fecha confirmada por cliente
 *  - actor/actriz / quién filma
 *
 * Vive en cliente detail → tab Piezas (cerca de Recursos del ciclo).
 * Se sincroniza por ciclo (no por pieza individual).
 */
export default function GrabacionWidget({ agenciaId, clienteId, cicloMes, canEdit }: Props) {
  const [recursos, setRecursos] = useState<ClienteCicloRecursos | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<{
    fecha_grabacion_tentativa: string
    fecha_grabacion_confirmada: string
    actor_actriz: string
  }>({ fecha_grabacion_tentativa: '', fecha_grabacion_confirmada: '', actor_actriz: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cliente_ciclo_recursos')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('ciclo_mes', cicloMes)
      .maybeSingle()
    const r = (data as ClienteCicloRecursos) ?? null
    setRecursos(r)
    setForm({
      fecha_grabacion_tentativa: r?.fecha_grabacion_tentativa ?? '',
      fecha_grabacion_confirmada: r?.fecha_grabacion_confirmada ?? '',
      actor_actriz: r?.actor_actriz ?? '',
    })
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-line */ }, [clienteId, cicloMes])

  // Realtime sync
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => load()
    window.addEventListener('estado-loop-changed', handler)
    return () => window.removeEventListener('estado-loop-changed', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, cicloMes])

  const save = async () => {
    setSaving(true); setError(null)
    const { error: e } = await supabase
      .from('cliente_ciclo_recursos')
      .upsert({
        agencia_id: agenciaId,
        cliente_id: clienteId,
        ciclo_mes: cicloMes,
        fecha_grabacion_tentativa: form.fecha_grabacion_tentativa || null,
        fecha_grabacion_confirmada: form.fecha_grabacion_confirmada || null,
        actor_actriz: form.actor_actriz.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cliente_id,ciclo_mes' })
    setSaving(false)
    if (e) { setError(e.message); return }
    setEditing(false)
    load()
  }

  const formatDate = (s: string | null | undefined): string => {
    if (!s) return '—'
    return new Date(s + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const tent = recursos?.fecha_grabacion_tentativa
  const conf = recursos?.fecha_grabacion_confirmada
  const isConfirmed = !!conf
  const showTent = !!tent && !isConfirmed
  const actor = recursos?.actor_actriz

  return (
    <div style={{
      marginBottom: 16, padding: 14,
      background: 'linear-gradient(135deg, rgba(94,114,228,.10) 0%, rgba(94,114,228,.04) 100%)',
      border: '1px solid rgba(94,114,228,.30)',
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap' as const, gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#a0b4f5', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            🎥 Grabación del ciclo
          </div>
          <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2 }}>
            Tentativa, confirmación del cliente y quién filma
          </div>
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 600,
              background: 'transparent', border: '1px solid rgba(94,114,228,.55)',
              color: '#a0b4f5', borderRadius: 4, cursor: 'pointer',
            }}>
            <i className="fas fa-pen" style={{ marginRight: 4 }} />
            {(tent || conf || actor) ? 'Editar' : 'Cargar'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: '#6a6a80' }}>Cargando…</div>
      ) : editing ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <Field label="Fecha tentativa" hint="propuesta interna">
              <input type="date" value={form.fecha_grabacion_tentativa}
                onChange={e => setForm({ ...form, fecha_grabacion_tentativa: e.target.value })}
                style={inputStyle} />
            </Field>
            <Field label="Fecha confirmada" hint="por cliente">
              <input type="date" value={form.fecha_grabacion_confirmada}
                onChange={e => setForm({ ...form, fecha_grabacion_confirmada: e.target.value })}
                style={inputStyle} />
            </Field>
            <Field label="Actor / actriz / filmer" hint="quién filma">
              <input type="text" value={form.actor_actriz}
                onChange={e => setForm({ ...form, actor_actriz: e.target.value })}
                placeholder="ej: Mati / cliente / Pedro García"
                style={inputStyle} />
            </Field>
          </div>
          {error && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)', color: '#f5365c', fontSize: 11, fontWeight: 600 }}>
              <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />{error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => { setEditing(false); load() }} disabled={saving}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid #2a2a40', color: '#a0a0b8', borderRadius: 4, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: '#5e72e4', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {/* Confirmada o tentativa */}
          <Pill
            label={isConfirmed ? 'Confirmada' : 'Tentativa'}
            value={isConfirmed ? formatDate(conf) : (showTent ? formatDate(tent) : '—')}
            color={isConfirmed ? '#00d97e' : showTent ? '#f5a623' : '#6a6a80'}
            icon={isConfirmed ? 'fa-calendar-check' : 'fa-calendar-day'}
          />
          {/* Si hay tentativa Y confirmada, mostrar las dos */}
          {isConfirmed && tent && tent !== conf && (
            <Pill
              label="Tentativa original"
              value={formatDate(tent)}
              color="#6a6a80"
              icon="fa-calendar-day"
              dimmed
            />
          )}
          {/* Actor */}
          <Pill
            label="Actor / Filmer"
            value={actor || '—'}
            color={actor ? '#a78bfa' : '#6a6a80'}
            icon="fa-user"
          />
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10, color: '#a0b4f5', fontWeight: 700,
        textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 4,
      }}>
        {label}
        {hint && <span style={{ marginLeft: 6, color: '#6a6a80', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0 }}>· {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Pill({ label, value, color, icon, dimmed }: { label: string; value: string; color: string; icon: string; dimmed?: boolean }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 6,
      background: color + '12', border: `1px solid ${color}33`,
      opacity: dimmed ? 0.6 : 1,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4 }}>
        <i className={`fas ${icon}`} style={{ marginRight: 4 }} />
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: value === '—' ? '#3a3a55' : '#e8e8f0' }}>
        {value}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px',
  background: '#0a0a0f', border: '1px solid rgba(94,114,228,.30)',
  borderRadius: 5, color: '#e8e8f0', fontSize: 12,
  outline: 'none', fontFamily: 'inherit',
}
