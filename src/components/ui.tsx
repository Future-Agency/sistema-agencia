'use client'
import { useEffect } from 'react'

export function SemaforoIcon({ color, size = 'sm' }: { color: string; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'semaforo semaforo-lg' : 'semaforo'
  const colorCls = color === 'green' ? 's-green' : color === 'yellow' ? 's-yellow' : color === 'blue' ? 's-green' : 's-red'
  return <span className={`${cls} ${colorCls}`} />
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const cls = color === 'green' ? 'badge-green' : color === 'yellow' ? 'badge-yellow' : color === 'red' ? 'badge-red' : color === 'blue' ? 'badge-blue' : 'badge-default'
  return <span className={`badge ${cls}`}>{children}</span>
}

export function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
      <div className="spinner" />
      <span style={{ color: '#6a6a80', fontSize: 13 }}>Cargando datos...</span>
    </div>
  )
}

export function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className={`toast toast-${type}`}>
      <i className={`fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} />
      {message}
    </div>
  )
}
