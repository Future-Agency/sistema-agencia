'use client'
import { useEffect, useState } from 'react'
import { supabase, type Cliente } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'

type Props = {
  cliente: Cliente
  currentUser?: CurrentUser
  onUpdate: () => void
}

/**
 * Observaciones cross-loop del cliente:
 *  - Internas: solo equipo de la agencia (admin/semi-admin/miembros que ven al cliente).
 *  - Cliente: nota visible para el cliente (eventualmente en portal cliente).
 *
 * Estas observaciones NO se borran al cambiar de ciclo. Persisten siempre.
 */
export default function ObservacionesCliente({ cliente, onUpdate }: Props) {
  const [obsInternas, setObsInternas] = useState(cliente.obs_internas ?? '')
  const [obsCliente, setObsCliente] = useState(cliente.obs_cliente ?? '')
  const [editingInt, setEditingInt] = useState(false)
  const [editingCli, setEditingCli] = useState(false)
  const [savingInt, setSavingInt] = useState(false)
  const [savingCli, setSavingCli] = useState(false)

  // Sincronizar si llega update externo
  useEffect(() => { setObsInternas(cliente.obs_internas ?? '') }, [cliente.obs_internas])
  useEffect(() => { setObsCliente(cliente.obs_cliente ?? '') }, [cliente.obs_cliente])

  const saveInternas = async () => {
    setSavingInt(true)
    await supabase.from('clientes').update({
      obs_internas: obsInternas.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', cliente.id)
    setSavingInt(false)
    setEditingInt(false)
    onUpdate()
  }
  const saveCliente = async () => {
    setSavingCli(true)
    await supabase.from('clientes').update({
      obs_cliente: obsCliente.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', cliente.id)
    setSavingCli(false)
    setEditingCli(false)
    onUpdate()
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 20 }}>
      {/* Observaciones internas — solo equipo */}
      <ObsCard
        title="Observaciones internas"
        subtitle="Visible solo para el equipo — persiste entre loops"
        icon="fa-lock"
        color="#f5a623"
        value={obsInternas}
        editing={editingInt}
        saving={savingInt}
        placeholder="ej: cliente exigente con tono; siempre revisa los reels antes de subir; nunca aprobó campañas en menos de 3 días…"
        onChange={setObsInternas}
        onStartEdit={() => setEditingInt(true)}
        onCancel={() => { setObsInternas(cliente.obs_internas ?? ''); setEditingInt(false) }}
        onSave={saveInternas}
      />

      {/* Observaciones cliente — visible (eventualmente en portal) */}
      <ObsCard
        title="Observaciones del cliente"
        subtitle="Visible para el cliente — persiste entre loops"
        icon="fa-user"
        color="#5e72e4"
        value={obsCliente}
        editing={editingCli}
        saving={savingCli}
        placeholder="ej: prefiere comunicación por WhatsApp; objetivo principal es captación de leads; tono casual pero profesional…"
        onChange={setObsCliente}
        onStartEdit={() => setEditingCli(true)}
        onCancel={() => { setObsCliente(cliente.obs_cliente ?? ''); setEditingCli(false) }}
        onSave={saveCliente}
      />
    </div>
  )
}

function ObsCard({
  title, subtitle, icon, color, value, editing, saving, placeholder,
  onChange, onStartEdit, onCancel, onSave,
}: {
  title: string; subtitle: string; icon: string; color: string
  value: string; editing: boolean; saving: boolean; placeholder: string
  onChange: (v: string) => void
  onStartEdit: () => void; onCancel: () => void; onSave: () => void
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}10 0%, ${color}03 100%)`,
      border: `1px solid ${color}33`,
      borderRadius: 10,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            <i className={`fas ${icon}`} />
            {title}
          </div>
          <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2 }}>{subtitle}</div>
        </div>
        {!editing && (
          <button onClick={onStartEdit}
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              background: 'transparent', border: `1px solid ${color}55`,
              color, borderRadius: 4, cursor: 'pointer',
            }}>
            <i className="fas fa-pen" style={{ marginRight: 4 }} />
            {value ? 'Editar' : 'Agregar'}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={3}
            autoFocus
            placeholder={placeholder}
            style={{
              width: '100%', padding: '8px 10px',
              background: '#0a0a0f', border: `1px solid ${color}33`,
              borderRadius: 6, color: '#e8e8f0', fontSize: 12,
              outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const,
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={onCancel} disabled={saving}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: 'transparent', border: '1px solid #2a2a40', color: '#a0a0b8', borderRadius: 4, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={onSave} disabled={saving}
              style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, background: color, color: '#0a0a0f', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      ) : (
        <div style={{
          fontSize: 12, color: value ? '#e8e8f0' : '#4a4a60',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap' as const,
          fontStyle: value ? 'normal' as const : 'italic' as const,
          minHeight: 40,
        }}>
          {value || `Sin observaciones · click en "Agregar" para escribir`}
        </div>
      )}
    </div>
  )
}
