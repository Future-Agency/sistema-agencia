'use client'
import { useEffect, useRef, useState } from 'react'
import { USERS, USER_TITLES, authenticate, initialsFor, type CurrentUser, type UserRole } from '@/lib/users'

type Props = {
  onLogin: (user: CurrentUser) => void
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  'semi-admin': 'Líder',
  miembro: 'Equipo',
}

const ROLE_ICON: Record<UserRole, string> = {
  admin: 'fa-shield-halved',
  'semi-admin': 'fa-star',
  miembro: 'fa-user',
}

export default function LoginOverlay({ onLogin }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const userEntries = Object.entries(USERS)

  // Auto-focus input cuando se selecciona un user
  useEffect(() => {
    if (picked && inputRef.current) {
      inputRef.current.focus()
      setPin('')
      setError(null)
    }
  }, [picked])

  // Auto-submit cuando hay 4 dígitos
  useEffect(() => {
    if (pin.length === 4 && picked) {
      const user = authenticate(picked, pin)
      if (user) {
        onLogin(user)
      } else {
        setError('PIN incorrecto')
        setPin('')
      }
    }
  }, [pin, picked, onLogin])

  const groupedByRole: Record<UserRole, [string, typeof USERS[string]][]> = {
    admin: [],
    'semi-admin': [],
    miembro: [],
  }
  userEntries.forEach(([name, def]) => groupedByRole[def.role].push([name, def]))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a1a28 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, overflow: 'auto',
    }}>
      <div style={{
        width: '100%', maxWidth: 720,
        background: 'rgba(26,26,40,.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #2a2a40',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(135deg, #5e72e4 0%, #8965e0 100%)',
            marginBottom: 12,
          }}>
            <i className="fas fa-rotate" style={{ color: '#fff', fontSize: 24 }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>
            Sistema Agencia
          </h1>
          <p style={{ fontSize: 12, color: '#6a6a80', margin: 0 }}>
            Elegí tu usuario para entrar
          </p>
        </div>

        {/* Picked = mostrar PIN row */}
        {picked ? (
          <PinPanel
            name={picked}
            pin={pin}
            error={error}
            inputRef={inputRef}
            onChange={setPin}
            onBack={() => { setPicked(null); setPin(''); setError(null) }}
          />
        ) : (
          // Avatares grouped por rol
          <div>
            {(['admin', 'semi-admin', 'miembro'] as UserRole[]).map(role => {
              const list = groupedByRole[role]
              if (list.length === 0) return null
              return (
                <div key={role} style={{ marginBottom: 22 }}>
                  <div style={{
                    fontSize: 10, color: '#6a6a80', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <i className={`fas ${ROLE_ICON[role]}`} />
                    {ROLE_LABEL[role]}s
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
                    gap: 8,
                  }}>
                    {list.map(([name, def]) => (
                      <button
                        key={name}
                        onClick={() => setPicked(name)}
                        title={USER_TITLES[name] || ''}
                        style={{
                          background: '#1a1a28',
                          border: '1px solid #2a2a40',
                          borderRadius: 10,
                          padding: '12px 6px',
                          cursor: 'pointer',
                          transition: 'all .15s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          minHeight: 110,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = def.color || '#5e72e4'
                          e.currentTarget.style.background = '#22223a'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = '#2a2a40'
                          e.currentTarget.style.background = '#1a1a28'
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: (def.color || '#5e72e4') + '22',
                          color: def.color || '#5e72e4',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 14,
                        }}>
                          {initialsFor(name)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#e8e8f0', textAlign: 'center' as const, lineHeight: 1.2 }}>
                            {name}
                          </span>
                          {USER_TITLES[name] && (
                            <span style={{ fontSize: 9, color: '#6a6a80', textAlign: 'center' as const, lineHeight: 1.2 }}>
                              {USER_TITLES[name]}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 12, paddingTop: 16, borderTop: '1px solid #2a2a40',
          textAlign: 'center', fontSize: 10, color: '#4a4a60',
        }}>
          <i className="fas fa-lock" style={{ marginRight: 4 }} />
          Sesión válida por 30 días en este navegador
        </div>
      </div>
    </div>
  )
}

// ============== PIN Panel ==============

function PinPanel({
  name, pin, error, inputRef, onChange, onBack,
}: {
  name: string
  pin: string
  error: string | null
  inputRef: React.RefObject<HTMLInputElement>
  onChange: (v: string) => void
  onBack: () => void
}) {
  const def = USERS[name]
  const color = def.color || '#5e72e4'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      {/* Avatar grande */}
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: color + '22', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 32,
        border: `2px solid ${color}55`,
      }}>
        {initialsFor(name)}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
          {name}
        </div>
        <div style={{
          fontSize: 11, color: '#6a6a80', marginTop: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <i className={`fas ${ROLE_ICON[def.role]}`} />
          {USER_TITLES[name] || ROLE_LABEL[def.role]}
        </div>
      </div>

      {/* PIN bullets */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: pin.length > i ? color : 'transparent',
            border: `2px solid ${pin.length > i ? color : '#2a2a40'}`,
            transition: 'all .15s',
          }} />
        ))}
      </div>

      {/* Input invisible */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          onChange(v)
        }}
        style={{
          position: 'absolute',
          width: 1, height: 1, padding: 0, margin: -1,
          overflow: 'hidden', clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap', border: 0,
        }}
      />

      {/* Numeric keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: 220 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <KeyButton key={n} onClick={() => pin.length < 4 && onChange(pin + n)}>
            {n}
          </KeyButton>
        ))}
        <div /> {/* spacer */}
        <KeyButton onClick={() => pin.length < 4 && onChange(pin + '0')}>0</KeyButton>
        <KeyButton onClick={() => onChange(pin.slice(0, -1))} variant="del">
          <i className="fas fa-delete-left" />
        </KeyButton>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          fontSize: 12, color: '#f5365c', fontWeight: 600,
          padding: '6px 12px', background: 'rgba(245,54,92,.10)',
          borderRadius: 6, border: '1px solid rgba(245,54,92,.25)',
        }}>
          <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />
          {error}
        </div>
      )}

      {/* Back */}
      <button
        onClick={onBack}
        style={{
          background: 'transparent', border: 'none',
          color: '#6a6a80', fontSize: 12, cursor: 'pointer',
          padding: '6px 12px',
        }}
      >
        <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />
        Volver
      </button>
    </div>
  )
}

function KeyButton({
  children, onClick, variant = 'normal',
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: 'normal' | 'del'
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: variant === 'del' ? '#22223a' : '#1a1a28',
        border: '1px solid #2a2a40',
        borderRadius: 10,
        padding: '14px 0',
        color: variant === 'del' ? '#a0a0b8' : '#e8e8f0',
        fontSize: 18,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all .1s',
      }}
      onMouseDown={e => (e.currentTarget.style.background = '#2a2a40')}
      onMouseUp={e => (e.currentTarget.style.background = variant === 'del' ? '#22223a' : '#1a1a28')}
      onMouseLeave={e => (e.currentTarget.style.background = variant === 'del' ? '#22223a' : '#1a1a28')}
    >
      {children}
    </button>
  )
}
