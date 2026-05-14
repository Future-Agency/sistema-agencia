'use client'
import { useEffect, useMemo, useState } from 'react'
import { SemaforoIcon } from './ui'
import type { Cliente, Owner, Equipo, LoopLog } from '@/lib/supabase'
import { namesMatch, type CurrentUser } from '@/lib/users'
import { getEstadoStyle } from '@/lib/estados'
import { quilomboScore } from '@/lib/quilomboScore'
import { queryLoops, currentCicloMes, SECCION_LABELS } from '@/lib/loopLog'

type Props = {
  user: CurrentUser
  clientes: Cliente[]
  owners: Owner[]
  equipo: Equipo[]
  onSelectCliente: (c: Cliente) => void
  agenciaId?: string
}

function diffDays(target: Date, ref: Date = new Date()): number {
  return Math.floor((target.getTime() - ref.getTime()) / 86400000)
}

export default function TableroMisTareas({ user, clientes, owners, equipo, onSelectCliente, agenciaId }: Props) {
  const today = useMemo(() => new Date(), [])
  const [myLoops, setMyLoops] = useState<LoopLog[]>([])

  // Cargar loops donde el user es responsable (ciclo actual)
  useEffect(() => {
    if (!agenciaId) return
    let cancelled = false
    queryLoops({ agenciaId, cicloMes: currentCicloMes(), responsable: user.name }).then(loops => {
      if (!cancelled) setMyLoops(loops)
    })
    return () => { cancelled = true }
  }, [agenciaId, user.name])

  const clienteById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])

  // Match user.name → owner IDs y equipo IDs (helper que funciona con nombre completo o corto)
  const myOwnerIds = useMemo(() => {
    return new Set(
      owners
        .filter(o => namesMatch(user.name, o.nombre) || namesMatch(user.name, o.nombre_corto))
        .map(o => o.id)
    )
  }, [owners, user.name])

  const myEquipoIds = useMemo(() => {
    return new Set(
      equipo
        .filter(e => namesMatch(user.name, e.nombre))
        .map(e => e.id)
    )
  }, [equipo, user.name])

  // Clientes asignados al user (owner OR equipo en cualquier rol)
  const misClientes = useMemo(() => {
    return clientes.filter(c => {
      if (c.owner_id && myOwnerIds.has(c.owner_id)) return true
      if (c.copy_id && myEquipoIds.has(c.copy_id)) return true
      if (c.editor_id && myEquipoIds.has(c.editor_id)) return true
      if (c.disenador_id && myEquipoIds.has(c.disenador_id)) return true
      return false
    })
  }, [clientes, myOwnerIds, myEquipoIds])

  // Buckets por urgencia de proximo_hito
  const buckets = useMemo(() => {
    const urgentes: Cliente[] = []
    const semana: Cliente[] = []
    const restantes: Cliente[] = []
    for (const c of misClientes) {
      if (!c.proximo_hito) {
        restantes.push(c)
        continue
      }
      const t = new Date(c.proximo_hito)
      if (isNaN(t.getTime())) {
        restantes.push(c)
        continue
      }
      const d = diffDays(t, today)
      if (d <= 3) urgentes.push(c)
      else if (d <= 7) semana.push(c)
      else restantes.push(c)
    }
    // Ordenar urgentes por días asc (más urgente primero)
    urgentes.sort((a, b) => {
      const da = a.proximo_hito ? diffDays(new Date(a.proximo_hito), today) : 999
      const db = b.proximo_hito ? diffDays(new Date(b.proximo_hito), today) : 999
      return da - db
    })
    semana.sort((a, b) => {
      const da = a.proximo_hito ? diffDays(new Date(a.proximo_hito), today) : 999
      const db = b.proximo_hito ? diffDays(new Date(b.proximo_hito), today) : 999
      return da - db
    })
    // Restantes ordenados por quilombo desc
    restantes.sort((a, b) => quilomboScore(b, today).score - quilomboScore(a, today).score)
    return { urgentes, semana, restantes }
  }, [misClientes, today])

  if (misClientes.length === 0) {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>👋</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Hola {user.name}</h2>
        <p style={{ color: '#6a6a80', fontSize: 14, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
          No encontré clientes asignados a vos en esta agencia.
          {user.role !== 'admin' && (
            <><br /><br />Si esto es un error, pedile a un admin que te asigne en el equipo (campo &quot;nombre&quot; debe coincidir con &quot;{user.name}&quot;).</>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Saludo */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          👋 Hola {user.name}
        </h2>
        <p style={{ fontSize: 13, color: '#6a6a80' }}>
          {buckets.urgentes.length > 0 ? (
            <><span style={{ color: '#f5365c', fontWeight: 700 }}>{buckets.urgentes.length}</span> urgente{buckets.urgentes.length !== 1 ? 's' : ''} · </>
          ) : null}
          {misClientes.length} cliente{misClientes.length !== 1 ? 's' : ''} asignado{misClientes.length !== 1 ? 's' : ''}
          {user.areas.length > 0 && user.role !== 'admin' && (
            <> · áreas: {user.areas.join(', ')}</>
          )}
        </p>
      </div>

      {/* URGENTE */}
      {buckets.urgentes.length > 0 && (
        <Section
          icon="fa-fire"
          title="Urgente"
          subtitle={`Deadline en ≤ 3 días — ${buckets.urgentes.length}`}
          color="#f5365c"
          bg="rgba(245,54,92,.08)"
        >
          {buckets.urgentes.map(c => <ClienteCard key={c.id} cliente={c} owners={owners} equipo={equipo} onClick={() => onSelectCliente(c)} today={today} accent="#f5365c" />)}
        </Section>
      )}

      {/* LOOPS — donde el user es responsable (Fase 2) */}
      {myLoops.length > 0 ? (
        <Section
          icon="fa-rotate"
          title="Loops"
          subtitle={`${myLoops.length} corrección${myLoops.length !== 1 ? 'es' : ''} donde sos responsable este ciclo · $${myLoops.reduce((s, l) => s + (l.cost_usd ?? 0), 0).toFixed(2)} USD`}
          color="#f5365c"
          bg="rgba(245,54,92,.08)"
        >
          {myLoops.slice(0, 6).map(l => {
            const cliente = l.cliente_id ? clienteById.get(l.cliente_id) : null
            const meta = SECCION_LABELS[l.seccion]
            return (
              <div
                key={l.id}
                onClick={() => cliente && onSelectCliente(cliente)}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #2a2a40',
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr auto auto',
                  gap: 12, alignItems: 'center',
                  cursor: cliente ? 'pointer' : 'default',
                  fontSize: 12,
                }}
              >
                <span style={{
                  padding: '3px 6px', borderRadius: 4,
                  background: meta.color + '22', color: meta.color,
                  fontSize: 10, fontWeight: 700, textAlign: 'center',
                }}>
                  {meta.icon} {meta.label.toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cliente?.nombre || '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 2 }}>
                    {l.reason || '(sin razón)'} · {new Date(l.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#a0a0b8',
                  padding: '2px 6px', background: '#1a1a28', borderRadius: 3,
                }}>
                  −{l.stages_back}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f5365c' }}>
                  ${(l.cost_usd ?? 0).toFixed(0)}
                </span>
              </div>
            )
          })}
          {myLoops.length > 6 && (
            <div style={{ padding: '8px 16px', fontSize: 10, color: '#6a6a80', textAlign: 'center' }}>
              + {myLoops.length - 6} más en este ciclo
            </div>
          )}
        </Section>
      ) : (
        <Section
          icon="fa-rotate"
          title="Loops"
          subtitle="Correcciones donde sos responsable"
          color="#00d97e"
          bg="rgba(0,217,126,.06)"
        >
          <div style={{ padding: '14px 16px', color: '#6a6a80', fontSize: 12 }}>
            <i className="fas fa-circle-check" style={{ marginRight: 6, color: '#00d97e' }} />
            Sin loops registrados este ciclo a tu nombre. {agenciaId ? '' : '(Necesita conexión a la agencia.)'}
          </div>
        </Section>
      )}

      {/* ESTA SEMANA */}
      {buckets.semana.length > 0 && (
        <Section
          icon="fa-calendar-week"
          title="Esta semana"
          subtitle={`Deadline en 4-7 días — ${buckets.semana.length}`}
          color="#f5a623"
          bg="rgba(245,166,35,.08)"
        >
          {buckets.semana.map(c => <ClienteCard key={c.id} cliente={c} owners={owners} equipo={equipo} onClick={() => onSelectCliente(c)} today={today} accent="#f5a623" />)}
        </Section>
      )}

      {/* TUS CLIENTES — el resto */}
      {buckets.restantes.length > 0 && (
        <Section
          icon="fa-list"
          title="Tus clientes"
          subtitle={`${buckets.restantes.length} más en seguimiento`}
          color="#5e72e4"
          bg="#1a1a28"
        >
          {buckets.restantes.map(c => <ClienteCard key={c.id} cliente={c} owners={owners} equipo={equipo} onClick={() => onSelectCliente(c)} today={today} accent="#5e72e4" />)}
        </Section>
      )}
    </div>
  )
}

// ============== Subcomponentes ==============

function Section({
  icon, title, subtitle, color, bg, children,
}: {
  icon: string
  title: string
  subtitle: string
  color: string
  bg: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${color}22`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: color + '22', color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className={`fas ${icon}`} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{title}</div>
            <div style={{ fontSize: 11, color: '#6a6a80', marginTop: 1 }}>{subtitle}</div>
          </div>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}

function ClienteCard({
  cliente, owners, equipo, onClick, today, accent,
}: {
  cliente: Cliente
  owners: Owner[]
  equipo: Equipo[]
  onClick: () => void
  today: Date
  accent: string
}) {
  const owner = owners.find(o => o.id === cliente.owner_id) ?? null
  const copy = equipo.find(e => e.id === cliente.copy_id) ?? null
  const editor = equipo.find(e => e.id === cliente.editor_id) ?? null
  const disenador = equipo.find(e => e.id === cliente.disenador_id) ?? null

  const days = cliente.proximo_hito
    ? diffDays(new Date(cliente.proximo_hito), today)
    : null
  const estadoStyle = getEstadoStyle(cliente.estado)

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid #2a2a40',
        cursor: 'pointer',
        transition: 'background .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <SemaforoIcon color={cliente.semaforo_general} />

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.nombre}</span>
          {cliente.is_onboarding && (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'rgba(245,166,35,.15)', color: '#f5a623', fontWeight: 700 }}>
              ONBOARDING
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6a6a80' }}>
          <span style={{
            padding: '2px 8px', borderRadius: 3,
            background: estadoStyle.bg, color: estadoStyle.color,
            fontSize: 10, fontWeight: 600,
          }}>{cliente.estado || '—'}</span>
          {days !== null && (
            <span style={{ color: days < 0 ? '#f5365c' : days <= 3 ? '#f5a623' : '#6a6a80' }}>
              <i className="fas fa-clock" style={{ marginRight: 3 }} />
              {days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'hoy' : `${days}d`}
            </span>
          )}
          {cliente.proximo_hito && (
            <span><i className="fas fa-flag-checkered" style={{ marginRight: 3 }} />{new Date(cliente.proximo_hito).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</span>
          )}
        </div>
      </div>

      {/* Mini avatares de equipo asignado */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[copy, editor, disenador].filter(Boolean).slice(0, 3).map((e, i) => e ? (
          <div key={`${e.id}-${i}`} title={`${e.nombre} (${e.rol})`} style={{
            width: 22, height: 22, borderRadius: 5,
            background: (e.color || '#5e72e4') + '22',
            color: e.color || '#5e72e4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 9,
          }}>
            {e.nombre.charAt(0).toUpperCase()}
          </div>
        ) : null)}
        {owner && (
          <div title={`Owner: ${owner.nombre}`} style={{
            width: 22, height: 22, borderRadius: 5,
            background: owner.color + '22',
            color: owner.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 9,
            border: `1px dashed ${owner.color}66`,
          }}>
            {owner.nombre_corto[0]}
          </div>
        )}
      </div>

      <i className="fas fa-chevron-right" style={{ color: accent, fontSize: 11, opacity: 0.6 }} />
    </div>
  )
}
