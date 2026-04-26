'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginPortal, getSession } from '@/lib/portalAuth'

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a14' }} />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initialSlug = params?.get('slug') || ''
  const [slug, setSlug] = useState(initialSlug)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const s = getSession()
    if (s) router.replace(`/portal/${s.slug}`)
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await loginPortal(slug, username, password)
    setLoading(false)
    if (!res.ok) {
      setError(res.error || 'Error')
      return
    }
    router.replace(`/portal/${res.session!.slug}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1a1a3a 0%, #0a0a14 50%, #050508 100%)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(20, 20, 32, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(94, 114, 228, 0.2)',
        borderRadius: 20,
        padding: 36,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60, height: 60, margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #5e72e4, #8965e0)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(94,114,228,0.4)',
          }}>
            <i className="fas fa-rocket" style={{ fontSize: 26, color: 'white' }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#e8e8f0' }}>Portal del Cliente</h1>
          <p style={{ fontSize: 13, color: '#8a8aa0', marginTop: 6 }}>Future Agency</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a0a0b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Cliente
            </label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="ej: aircloud"
              required
              autoFocus
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0e0e18', border: '1px solid #2a2a40',
                borderRadius: 10, color: '#e8e8f0', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a0a0b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0e0e18', border: '1px solid #2a2a40',
                borderRadius: 10, color: '#e8e8f0', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#a0a0b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0e0e18', border: '1px solid #2a2a40',
                borderRadius: 10, color: '#e8e8f0', fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(245, 54, 92, 0.1)',
              border: '1px solid rgba(245, 54, 92, 0.3)',
              borderRadius: 8,
              color: '#f5365c',
              fontSize: 12,
              marginBottom: 14,
            }}>
              <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading ? '#3a3a55' : 'linear-gradient(135deg, #5e72e4, #8965e0)',
              border: 'none', borderRadius: 10,
              color: 'white', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(94,114,228,0.3)',
            }}
          >
            {loading ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Ingresando...</> : <>Ingresar al Portal <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} /></>}
          </button>
        </form>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #1a1a28', textAlign: 'center', fontSize: 11, color: '#5a5a70' }}>
          ¿Problemas para ingresar? Contacta a tu Account Manager
        </div>
      </div>
    </div>
  )
}
