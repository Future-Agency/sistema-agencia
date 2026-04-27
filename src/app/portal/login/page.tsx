'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loginPortal, getSession } from '@/lib/portalAuth'

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const initialSlug = params?.get('slug') || ''
  const [step, setStep] = useState<'cuenta' | 'password'>(initialSlug ? 'password' : 'cuenta')
  const [slug, setSlug] = useState(initialSlug)
  const [username, setUsername] = useState(initialSlug)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const s = getSession()
    if (s) router.replace(`/portal/${s.slug}`)
  }, [router])

  async function next(e: React.FormEvent) {
    e.preventDefault()
    if (!slug.trim()) return
    setUsername(slug)
    setStep('password')
  }

  async function enter(e: React.FormEvent) {
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
      background: 'var(--bg)',
      color: 'var(--text)',
    }}>
      {/* ====== Panel izquierdo - branding ====== */}
      <div className="fa-login-left" style={{
        flex: 1.1,
        background: 'var(--brand-grad)',
        padding: '50px 56px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: '#fff',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 80% at 100% 100%, rgba(0,212,255,0.4) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '4px 4px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--brand-blue)', fontSize: 20, fontWeight: 900 }}>F</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, lineHeight: 1, letterSpacing: '-0.5px' }}>FUTURE</div>
            <div style={{ fontSize: 9, letterSpacing: '0.7px', opacity: 0.85, marginTop: 2 }}>AGENCY · PORTAL</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.8px', fontWeight: 700, marginBottom: 18, opacity: 0.9, textTransform: 'uppercase' }}>Tu marca, en tiempo real</div>
          <div className="fa-display" style={{ fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05, color: '#fff', marginBottom: 24 }}>
            Vení a ver<br />cuánto te <em>rinde</em><br />tu inversión.
          </div>
          <div style={{ fontSize: 15, opacity: 0.95, lineHeight: 1.5, maxWidth: 440 }}>
            Aprobaciones, pauta, ROAS, calendario, pagos. Todo lo que tu cuenta hace por vos — claro como el día.
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 28, fontSize: 11, opacity: 0.85, flexWrap: 'wrap' }}>
          <div><strong style={{ fontSize: 18, display: 'block' }}>120+</strong>marcas activas</div>
          <div><strong style={{ fontSize: 18, display: 'block' }}>$340M</strong>pauta gestionada</div>
          <div><strong style={{ fontSize: 18, display: 'block' }}>4.7x</strong>ROAS promedio</div>
        </div>
      </div>

      {/* ====== Panel derecho - formulario ====== */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 8 }}>Acceso de cliente</div>
          <div className="fa-display-up" style={{ fontSize: 30, marginBottom: 6 }}>Hola de nuevo 👋</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 30 }}>
            {step === 'cuenta' ? 'Ingresá el código de tu cuenta' : 'Ingresá tu clave para continuar'}
          </div>

          {step === 'cuenta' ? (
            <form onSubmit={next}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>Código de cuenta</label>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} type="text" autoFocus className="fa-input" placeholder="ej: aircloud" style={{ marginBottom: 16 }} />
              <button type="submit" className="fa-btn fa-btn-primary" disabled={!slug.trim()} style={{ width: '100%', padding: 14, fontSize: 14, justifyContent: 'center' }}>
                Continuar <i className="fas fa-arrow-right" />
              </button>
            </form>
          ) : (
            <form onSubmit={enter}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-1)', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="fas fa-user-circle" style={{ color: 'var(--brand-blue-soft)', fontSize: 22 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slug}</div>
                  <button type="button" onClick={() => setStep('cuenta')} style={{ background: 'none', border: 'none', color: 'var(--brand-blue-soft)', fontSize: 11, padding: 0, cursor: 'pointer' }}>Cambiar</button>
                </div>
              </div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>Usuario</label>
              <input value={username} onChange={e => setUsername(e.target.value)} type="text" className="fa-input" style={{ marginBottom: 12 }} />
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, fontWeight: 600 }}>Clave</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoFocus placeholder="••••••••" className="fa-input" style={{ marginBottom: 8 }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, fontSize: 12 }}>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked /> Recordarme
                </label>
                <a href="#" style={{ color: 'var(--brand-blue-soft)' }}>Olvidé mi clave</a>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(245,54,92,0.1)', border: '1px solid rgba(245,54,92,0.3)', borderRadius: 8, color: 'var(--bad)', fontSize: 12, marginBottom: 14 }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }} /> {error}
                </div>
              )}

              <button type="submit" className="fa-btn fa-btn-primary" disabled={loading} style={{ width: '100%', padding: 14, fontSize: 14, justifyContent: 'center' }}>
                {loading ? <i className="fas fa-spinner fa-spin" /> : <>Entrar al portal <i className="fas fa-arrow-right" /></>}
              </button>
            </form>
          )}

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>¿Problemas para entrar?</div>
            <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ok)', fontWeight: 600 }}>
              <i className="fab fa-whatsapp" /> Escribinos
            </a>
          </div>

          <div style={{ marginTop: 30, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
            © 2026 Future Agency · <a href="#" style={{ color: 'var(--text-muted)' }}>Términos</a> · <a href="#" style={{ color: 'var(--text-muted)' }}>Privacidad</a>
          </div>
        </div>
      </div>
    </div>
  )
}
