'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase, type Cliente, type ClienteCicloRecursos } from '@/lib/supabase'
import { generateBatch } from '@/lib/piezas'
import { cicloMesLabel, currentCicloMes, nextCicloMes, parseCicloMes } from '@/lib/cycles'
import type { CurrentUser } from '@/lib/users'

type Props = {
  agenciaId: string
  clientes: Cliente[]
  currentUser: CurrentUser
  onClose: () => void
  onDone: () => void
}

type ClientePreview = {
  cliente: Cliente
  ultimaGrabacion: Date | null
  fechaTentativaProyectada: Date
  yaTieneBatch: boolean
}

export default function CrearCicloCompletoModal({ agenciaId, clientes, currentUser, onClose, onDone }: Props) {
  // Default: próximo mes al ciclo activo
  const [cicloDestino, setCicloDestino] = useState<string>(() => nextCicloMes(currentCicloMes()))
  // Offset entre la última grabación y la próxima (default: 30 días = una grabación por mes)
  const [offsetDias, setOffsetDias] = useState(30)
  const [recursosAgencia, setRecursosAgencia] = useState<ClienteCicloRecursos[]>([])
  const [piezasExistentes, setPiezasExistentes] = useState<Map<number, boolean>>(new Map())
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [running, setRunning] = useState(false)
  const [resultado, setResultado] = useState<{ ok: number; fail: number; mensajes: string[] } | null>(null)
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set())
  const [confirmText, setConfirmText] = useState('')

  // Cargar recursos + piezas del ciclo destino para preview
  useEffect(() => {
    let cancel = false
    setLoadingPreview(true)
    Promise.all([
      supabase.from('cliente_ciclo_recursos').select('cliente_id, ciclo_mes, fecha_grabacion_confirmada, fecha_grabacion_tentativa').eq('agencia_id', agenciaId),
      supabase.from('piezas').select('cliente_id').eq('agencia_id', agenciaId).eq('ciclo_mes', cicloDestino),
    ]).then(([recR, piezasR]) => {
      if (cancel) return
      setRecursosAgencia((recR.data ?? []) as ClienteCicloRecursos[])
      const m = new Map<number, boolean>()
      for (const p of (piezasR.data ?? [])) m.set((p as { cliente_id: number }).cliente_id, true)
      setPiezasExistentes(m)
      setLoadingPreview(false)
    })
    return () => { cancel = true }
  }, [agenciaId, cicloDestino])

  const previews = useMemo<ClientePreview[]>(() => {
    const cicloDestinoDate = (() => {
      const p = parseCicloMes(cicloDestino)
      return p ? new Date(p.year, p.monthIndex, 1) : new Date()
    })()
    // Última grabación por cliente (la más reciente, confirmada o tentativa)
    const ultimaByCliente = new Map<number, Date>()
    for (const r of recursosAgencia) {
      const v = r.fecha_grabacion_confirmada || r.fecha_grabacion_tentativa
      if (!v) continue
      const d = new Date(v)
      if (isNaN(d.getTime())) continue
      const prev = ultimaByCliente.get(r.cliente_id)
      if (!prev || d > prev) ultimaByCliente.set(r.cliente_id, d)
    }
    return clientes
      .filter(c => c.activo && !c.standby)
      .map(c => {
        const ultima = ultimaByCliente.get(c.id) ?? null
        // Fecha tentativa = ultima + offset, o mediados del ciclo destino si no hay
        let tentativa: Date
        if (ultima) {
          tentativa = new Date(ultima); tentativa.setDate(tentativa.getDate() + offsetDias)
          // Si la tentativa cae ANTES del primer día del ciclo destino, empujar al ciclo
          if (tentativa < cicloDestinoDate) tentativa = new Date(cicloDestinoDate.getTime() + 14 * 86400000)
        } else {
          tentativa = new Date(cicloDestinoDate.getTime() + 14 * 86400000)
        }
        return { cliente: c, ultimaGrabacion: ultima, fechaTentativaProyectada: tentativa, yaTieneBatch: !!piezasExistentes.get(c.id) }
      })
  }, [clientes, recursosAgencia, piezasExistentes, cicloDestino, offsetDias])

  const aGenerar = previews.filter(p => !excluidos.has(p.cliente.id))
  const conBatch = aGenerar.filter(p => p.yaTieneBatch).length
  const sinBatch = aGenerar.length - conBatch
  const cicloLabel = cicloMesLabel(cicloDestino)
  const canExecute = aGenerar.length > 0 && confirmText.trim().toUpperCase() === cicloDestino.toUpperCase()

  const ejecutar = async () => {
    setRunning(true)
    const mensajes: string[] = []
    let ok = 0, fail = 0
    for (const p of aGenerar) {
      try {
        // 1. generar piezas (skip si ya existen)
        const r = await generateBatch({ agenciaId, cliente: p.cliente, cicloMes: cicloDestino })
        if (r.error) { fail++; mensajes.push(`✗ ${p.cliente.nombre}: ${r.error}`); continue }
        // 2. upsert recursos con fecha tentativa
        const ymd = p.fechaTentativaProyectada.toISOString().slice(0, 10)
        await supabase.from('cliente_ciclo_recursos').upsert({
          agencia_id: agenciaId,
          cliente_id: p.cliente.id,
          ciclo_mes: cicloDestino,
          fecha_grabacion_tentativa: ymd,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cliente_id,ciclo_mes' })
        ok++
        mensajes.push(`✓ ${p.cliente.nombre}: ${r.inserted} piezas, grab tentativa ${ymd}`)
      } catch (e: unknown) {
        fail++
        mensajes.push(`✗ ${p.cliente.nombre}: ${(e as Error).message}`)
      }
    }
    setRunning(false)
    setResultado({ ok, fail, mensajes })
  }

  if (resultado) {
    return (
      <div onClick={onClose} style={backdrop}>
        <div onClick={e => e.stopPropagation()} style={modal}>
          <h3 style={{ margin: 0, marginBottom: 14, color: '#fff', fontSize: 18 }}>
            {resultado.fail === 0 ? '✅' : '⚠️'} Ciclo {cicloLabel} creado
          </h3>
          <p style={{ fontSize: 13, color: '#a0a0b8', marginBottom: 12 }}>
            <strong style={{ color: '#00d97e' }}>{resultado.ok} OK</strong>
            {resultado.fail > 0 && <> · <strong style={{ color: '#f5365c' }}>{resultado.fail} con error</strong></>}
          </p>
          <div style={{ maxHeight: 300, overflowY: 'auto' as const, background: '#0a0a0f', borderRadius: 6, padding: 10, fontSize: 11, fontFamily: 'monospace', marginBottom: 14 }}>
            {resultado.mensajes.map((m, i) => (
              <div key={i} style={{ color: m.startsWith('✓') ? '#00d97e' : '#f5365c', marginBottom: 3 }}>{m}</div>
            ))}
          </div>
          <button onClick={() => { onDone(); onClose() }} style={primary}>Cerrar y refrescar</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={backdrop}>
      <div onClick={e => e.stopPropagation()} style={modal}>
        <h3 style={{ margin: 0, marginBottom: 6, color: '#fff', fontSize: 18 }}>📅 Crear ciclo completo</h3>
        <p style={{ fontSize: 12, color: '#a0a0b8', margin: 0, marginBottom: 14, lineHeight: 1.5 }}>
          Genera batches + fechas tentativas de grabación para TODOS los clientes activos en un ciclo futuro.
          Las tentativas se calculan según la última grabación de cada cliente + offset.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="Ciclo destino (ej: julio-2026)">
            <input value={cicloDestino} onChange={e => setCicloDestino(e.target.value.trim())} style={input} placeholder="julio-2026" />
            <div style={{ fontSize: 10, color: '#6a6a80', marginTop: 4, textTransform: 'capitalize' as const }}>{cicloLabel}</div>
          </Field>
          <Field label={`Offset desde última grabación: ${offsetDias}d`}>
            <input type="range" min={14} max={60} step={1} value={offsetDias} onChange={e => setOffsetDias(Number(e.target.value))} style={{ width: '100%' }} />
          </Field>
        </div>

        {loadingPreview ? (
          <div style={{ padding: 24, textAlign: 'center' as const, color: '#6a6a80' }}>Cargando previsualización…</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: '#a0a0b8', marginBottom: 6 }}>
              Vas a procesar <strong>{aGenerar.length}</strong> cliente{aGenerar.length === 1 ? '' : 's'}.
              {conBatch > 0 && <> <span style={{ color: '#f5a623' }}>{conBatch} ya tiene piezas en este ciclo</span> (se completa lo faltante).</>}
              {sinBatch > 0 && <> <span style={{ color: '#00d97e' }}>{sinBatch} batches nuevos</span>.</>}
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' as const, border: '1px solid #2a2a40', borderRadius: 6, marginBottom: 12 }}>
              {previews.map(p => {
                const excl = excluidos.has(p.cliente.id)
                return (
                  <div key={p.cliente.id}
                    onClick={() => {
                      const next = new Set(excluidos)
                      if (excl) next.delete(p.cliente.id); else next.add(p.cliente.id)
                      setExcluidos(next)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderTop: '1px solid #2a2a40', cursor: 'pointer',
                      background: excl ? 'rgba(106,106,128,.08)' : 'transparent',
                      opacity: excl ? 0.5 : 1,
                    }}>
                    <input type="checkbox" checked={!excl} readOnly style={{ pointerEvents: 'none' as const }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{p.cliente.nombre}</div>
                      <div style={{ fontSize: 10, color: '#6a6a80' }}>
                        última grab: {p.ultimaGrabacion ? p.ultimaGrabacion.toLocaleDateString('es-AR') : <span style={{ color: '#f5a623' }}>—</span>}
                      </div>
                    </div>
                    {p.yaTieneBatch && (
                      <span style={{ fontSize: 9, color: '#f5a623', background: 'rgba(245,166,35,.10)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>YA HAY BATCH</span>
                    )}
                    <span style={{ fontSize: 11, color: '#5e72e4', fontWeight: 700 }}>
                      → {p.fechaTentativaProyectada.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: '#f5a623', marginBottom: 6 }}>
              Para confirmar, tipeá el ciclo destino exacto (<code>{cicloDestino}</code>):
            </div>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder={cicloDestino} style={{ ...input, marginBottom: 12 }} />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={running} style={secondary}>Cancelar</button>
          <button onClick={ejecutar} disabled={!canExecute || running} style={{ ...primary, opacity: !canExecute || running ? 0.5 : 1, cursor: !canExecute || running ? 'not-allowed' : 'pointer' }}>
            {running ? 'Generando…' : `Crear ${aGenerar.length} batches`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: '#6a6a80', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const backdrop: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modal: React.CSSProperties = { width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' as const, background: '#12121a', border: '1px solid #2a2a40', borderRadius: 14, padding: '22px 24px' }
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#0a0a0f', border: '1px solid #2a2a40', borderRadius: 6, color: '#e8e8f0', fontSize: 13, outline: 'none' }
const primary: React.CSSProperties = { padding: '8px 16px', background: '#5e72e4', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const secondary: React.CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #2a2a40', color: '#a0a0b8', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
