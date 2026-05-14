'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type FechaEspecial } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'

type Props = {
  agenciaId: string
  currentUser: CurrentUser
}

function diffDays(target: Date, ref: Date = new Date()): number {
  return Math.floor((target.getTime() - ref.getTime()) / 86400000)
}

export default function TableroFechasEspeciales({ agenciaId, currentUser }: Props) {
  const [items, setItems] = useState<FechaEspecial[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<FechaEspecial> | null>(null)
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'semi-admin'

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('fechas_especiales')
      .select('*').eq('agencia_id', agenciaId)
      .order('fecha_evento', { ascending: true })
    if (error) {
      console.warn('[fechas_especiales] query error:', error)
      setItems([])
    } else {
      setItems((data ?? []) as FechaEspecial[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [agenciaId])

  const buckets = useMemo(() => {
    const today = new Date()
    const enRango: FechaEspecial[] = []
    const proximas: FechaEspecial[] = []
    const pasadas: FechaEspecial[] = []
    for (const f of items) {
      const t = new Date(f.fecha_evento)
      if (isNaN(t.getTime())) continue
      const days = diffDays(t, today)
      if (days < 0) pasadas.push(f)
      else if (days <= f.dias_anticipacion) enRango.push(f)
      else proximas.push(f)
    }
    return { enRango, proximas, pasadas }
  }, [items])

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🎉 Fechas Especiales</h2>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0, marginTop: 2 }}>
            Eventos con anticipación: Día del Padre, Black Friday, etc.
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setEditing({ nombre: '', fecha_evento: '', dias_anticipacion: 15 })}
            style={btnPrimary}>
            <i className="fas fa-plus" style={{ marginRight: 6 }} />Nueva fecha
          </button>
        )}
      </div>

      {loading ? <Loading /> : (
        <>
          {buckets.enRango.length > 0 && (
            <Section title="🔥 En anticipación" subtitle="Estas fechas ya están dentro del período de anticipación" color="#f5a623">
              {buckets.enRango.map(f => <Card key={f.id} f={f} canEdit={canEdit} onEdit={() => setEditing(f)} onDelete={async () => {
                if (!window.confirm(`Borrar "${f.nombre}"?`)) return
                await supabase.from('fechas_especiales').delete().eq('id', f.id)
                load()
              }} />)}
            </Section>
          )}
          {buckets.proximas.length > 0 && (
            <Section title="📅 Próximas" subtitle="Aún fuera del rango de anticipación" color="#5e72e4">
              {buckets.proximas.map(f => <Card key={f.id} f={f} canEdit={canEdit} onEdit={() => setEditing(f)} onDelete={async () => {
                if (!window.confirm(`Borrar "${f.nombre}"?`)) return
                await supabase.from('fechas_especiales').delete().eq('id', f.id)
                load()
              }} />)}
            </Section>
          )}
          {buckets.pasadas.length > 0 && (
            <Section title="✓ Pasadas" subtitle="Histórico" color="#6a6a80">
              {buckets.pasadas.map(f => <Card key={f.id} f={f} canEdit={canEdit} onEdit={() => setEditing(f)} onDelete={async () => {
                if (!window.confirm(`Borrar "${f.nombre}"?`)) return
                await supabase.from('fechas_especiales').delete().eq('id', f.id)
                load()
              }} dimmed />)}
            </Section>
          )}
          {items.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🗓️</div>
              <p style={{ fontSize: 13 }}>Sin fechas especiales registradas.</p>
              {canEdit && (
                <button onClick={() => setEditing({ nombre: '', fecha_evento: '', dias_anticipacion: 15 })}
                  style={{ ...btnPrimary, marginTop: 12 }}>
                  Crear la primera
                </button>
              )}
            </div>
          )}
        </>
      )}

      {editing && (
        <FechaEspecialModal
          agenciaId={agenciaId}
          currentUser={currentUser}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function Section({ title, subtitle, color, children }: { title: string; subtitle: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 6 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6a6a80' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function Card({ f, canEdit, onEdit, onDelete, dimmed }: { f: FechaEspecial; canEdit: boolean; onEdit: () => void; onDelete: () => void; dimmed?: boolean }) {
  const t = new Date(f.fecha_evento)
  const days = diffDays(t)
  const fmtFecha = t.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div style={{
      padding: '14px 16px',
      background: '#1a1a28',
      border: '1px solid #2a2a40',
      borderRadius: 10,
      opacity: dimmed ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{f.nombre}</div>
          <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 2 }}>📅 {fmtFecha}</div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onEdit} style={btnIcon('#5e72e4')}><i className="fas fa-pen" /></button>
            <button onClick={onDelete} style={btnIcon('#f5365c')}><i className="fas fa-trash" /></button>
          </div>
        )}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: days < 0 ? '#6a6a80' : days <= f.dias_anticipacion ? '#f5a623' : '#5e72e4',
      }}>
        {days < 0 ? `${Math.abs(days)}d después` : days === 0 ? 'HOY' : `Faltan ${days}d`}
        <span style={{ color: '#6a6a80', fontWeight: 500, marginLeft: 8 }}>· anticipación {f.dias_anticipacion}d</span>
      </div>
    </div>
  )
}

function Loading() {
  return <div style={{ padding: 32, textAlign: 'center', color: '#6a6a80', fontSize: 13 }}>Cargando…</div>
}

function FechaEspecialModal({ agenciaId, currentUser, item, onClose, onSaved }: {
  agenciaId: string; currentUser: CurrentUser; item: Partial<FechaEspecial>; onClose: () => void; onSaved: () => void
}) {
  const [nombre, setNombre] = useState(item.nombre ?? '')
  const [fecha, setFecha] = useState(item.fecha_evento ?? '')
  const [dias, setDias] = useState(item.dias_anticipacion ?? 15)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = !item.id

  const save = async () => {
    if (!nombre.trim() || !fecha) { setError('Nombre y fecha requeridos'); return }
    setSaving(true)
    setError(null)
    const payload = {
      agencia_id: agenciaId,
      nombre: nombre.trim(),
      fecha_evento: fecha,
      dias_anticipacion: dias,
      creado_por: currentUser.name,
      updated_at: new Date().toISOString(),
    }
    const { error: e } = isNew
      ? await supabase.from('fechas_especiales').insert(payload)
      : await supabase.from('fechas_especiales').update(payload).eq('id', item.id!)
    setSaving(false)
    if (e) { setError(e.message); return }
    onSaved()
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={modalBox}>
        <h3 style={{ margin: 0, marginBottom: 14, color: '#fff' }}>
          {isNew ? 'Nueva fecha especial' : 'Editar fecha especial'}
        </h3>
        <Field label="Nombre">
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Día del Padre" style={inputStyle} />
        </Field>
        <Field label="Fecha del evento">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
        </Field>
        <Field label={`Días de anticipación: ${dias}`}>
          <input type="range" min={0} max={60} value={dias} onChange={e => setDias(Number(e.target.value))} style={{ width: '100%' }} />
        </Field>
        {error && <div style={errorBox}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} disabled={saving} style={btnSecondary}>Cancelar</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

// ============== Shared styles ==============

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: '#5e72e4', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', border: '1px solid #2a2a40',
  color: '#a0a0b8', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
function btnIcon(color: string): React.CSSProperties {
  return {
    width: 26, height: 26, borderRadius: 6,
    background: color + '22', border: `1px solid ${color}33`, color,
    cursor: 'pointer', fontSize: 11,
  }
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: '#0a0a0f', border: '1px solid #2a2a40',
  borderRadius: 6, color: '#e8e8f0', fontSize: 13,
  outline: 'none',
}
const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(0,0,0,.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
}
const modalBox: React.CSSProperties = {
  width: '100%', maxWidth: 460,
  background: '#12121a', border: '1px solid #2a2a40',
  borderRadius: 14, padding: '22px 24px',
}
const errorBox: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6,
  background: 'rgba(245,54,92,.10)', border: '1px solid rgba(245,54,92,.25)',
  color: '#f5365c', fontSize: 12, fontWeight: 600, marginBottom: 8,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#6a6a80', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
