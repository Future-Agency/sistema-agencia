'use client'
import { useEffect, useMemo, useState } from 'react'
import type { Cliente, Equipo, LoopLog } from '@/lib/supabase'
import type { CurrentUser } from '@/lib/users'
import { queryLoops, summarizeLoops, currentCicloMes, SECCION_LABELS } from '@/lib/loopLog'
import LogLoopModal from './LogLoopModal'

type Props = {
  agenciaId: string
  currentUser: CurrentUser
  clientes: Cliente[]
  equipo: Equipo[]
  /** Si null o vacío = ciclo actual */
  cicloMes?: string
}

export default function LoopsPanel({ agenciaId, currentUser, clientes, equipo, cicloMes }: Props) {
  const cycle = cicloMes || currentCicloMes()
  const [loops, setLoops] = useState<LoopLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    queryLoops({ agenciaId, cicloMes: cycle }).then(data => {
      if (cancelled) return
      setLoops(data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [agenciaId, cycle, refreshTick])

  // Phase 8 — escuchar evento de realtime para refrescar
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setRefreshTick(t => t + 1)
    window.addEventListener('loops-refresh', handler)
    return () => window.removeEventListener('loops-refresh', handler)
  }, [])

  const summary = useMemo(() => summarizeLoops(loops), [loops])

  const clienteById = useMemo(() => {
    const m = new Map<number, Cliente>()
    clientes.forEach(c => m.set(c.id, c))
    return m
  }, [clientes])

  const topClients = useMemo(() => {
    return Object.entries(summary.byClient)
      .map(([id, v]) => ({
        cliente: clienteById.get(Number(id)),
        ...v,
      }))
      .filter(x => x.cliente)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [summary, clienteById])

  const topResponsables = useMemo(() => {
    return Object.entries(summary.byResponsable)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)
  }, [summary])

  const canLogLoop = currentUser.role === 'admin' || currentUser.role === 'semi-admin'

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-rotate" style={{ color: '#f5365c' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Loops del ciclo</div>
              <div style={{ fontSize: 11, color: '#6a6a80' }}>
                {cycle.toUpperCase()} · correcciones que costaron tiempo extra
              </div>
            </div>
          </div>
          {canLogLoop && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: '#f5365c', color: '#fff',
                border: 'none', borderRadius: 6, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className="fas fa-plus" /> Registrar loop
            </button>
          )}
        </div>
      </div>

      <div className="card-body">
        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#6a6a80', fontSize: 12 }}>
            Cargando loops…
          </div>
        ) : loops.length === 0 ? (
          <div style={{
            padding: '24px 16px', textAlign: 'center', color: '#6a6a80',
            background: 'rgba(94,114,228,.04)', borderRadius: 8,
          }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🟢</div>
            <div style={{ fontWeight: 700, color: '#a0a0b8', marginBottom: 4 }}>
              Sin loops registrados en {cycle}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              {tableMissing ? (
                <>La tabla <code style={{ background: '#1a1a28', padding: '1px 5px', borderRadius: 3 }}>loop_log</code> no existe todavía.<br />
                Aplicá <code style={{ background: '#1a1a28', padding: '1px 5px', borderRadius: 3 }}>sql/2026-05-07_phase_2_loop_log.sql</code> en Supabase.</>
              ) : canLogLoop ? (
                <>Todo en orden, o todavía no se registraron correcciones.<br />Usá <strong>+ Registrar loop</strong> cuando una corrección haga retroceder etapas.</>
              ) : (
                <>Sin correcciones registradas hasta ahora.</>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
              <KpiBox label="Loops total" value={String(summary.totalCount)} icon="fa-rotate" color="#f5365c" />
              <KpiBox label="Costo USD" value={`$${summary.totalCostUSD.toFixed(2)}`} icon="fa-coins" color="#f5a623" />
              <KpiBox label="Clientes con loops" value={String(Object.keys(summary.byClient).length)} icon="fa-users" color="#5e72e4" />
              <KpiBox
                label="Costo promedio"
                value={`$${summary.totalCount > 0 ? (summary.totalCostUSD / summary.totalCount).toFixed(2) : '0.00'}`}
                icon="fa-chart-line"
                color="#8965e0"
              />
            </div>

            {/* Por sección */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                Por sección
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
                {Object.entries(summary.bySection).map(([sec, v]) => {
                  const meta = SECCION_LABELS[sec as keyof typeof SECCION_LABELS]
                  if (!meta) return null
                  return (
                    <div key={sec} style={{
                      padding: '8px 10px',
                      background: meta.color + '15',
                      border: `1px solid ${meta.color}33`,
                      borderRadius: 6,
                    }}>
                      <div style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
                        {meta.icon} {meta.label}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: meta.color }}>
                        {v.count}
                        <span style={{ fontSize: 10, color: '#6a6a80', marginLeft: 6, fontWeight: 500 }}>
                          ${v.cost.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top clients + responsables */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {/* Top clients */}
              <div>
                <div style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                  Clientes con más loops
                </div>
                {topClients.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#6a6a80', fontStyle: 'italic' }}>—</div>
                ) : (
                  topClients.map(t => (
                    <div key={t.cliente?.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', borderRadius: 6,
                      background: '#1a1a28', marginBottom: 3, fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 600 }}>{t.cliente?.nombre}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#f5365c', fontWeight: 700 }}>{t.count}</span>
                        <span style={{ color: '#6a6a80', fontSize: 10 }}>${t.cost.toFixed(0)}</span>
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Top responsables */}
              <div>
                <div style={{ fontSize: 11, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                  Top responsables (por costo)
                </div>
                {topResponsables.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#6a6a80', fontStyle: 'italic' }}>—</div>
                ) : (
                  topResponsables.map(r => (
                    <div key={r.name} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', borderRadius: 6,
                      background: '#1a1a28', marginBottom: 3, fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#f5a623', fontWeight: 700 }}>${r.cost.toFixed(2)}</span>
                        <span style={{ color: '#6a6a80', fontSize: 10 }}>({r.count})</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <LogLoopModal
          agenciaId={agenciaId}
          currentUser={currentUser}
          clientes={clientes}
          equipo={equipo}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            setRefreshTick(t => t + 1)
          }}
        />
      )}
    </div>
  )
}

function KpiBox({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: color + '12',
      border: `1px solid ${color}33`,
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>
          {label}
        </span>
        <i className={`fas ${icon}`} style={{ color, fontSize: 12 }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
