import { useState } from 'react'

interface LoginProps { onBack: () => void; onSuccess: () => void }

export default function Login({ onBack, onSuccess }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('http://auth.zea.localhost/api/internal/agent-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: '4c4e2791-026b-4508-a2c3-1580bf86b661',
          scopes: ['cranium:read', 'cranium:write'],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('soma_token', data.token || 'ok')
        onSuccess()
      } else {
        setError('Authentication failed. Is Thalamus running?')
      }
    } catch {
      setError('Connection error. Is Thalamus running?')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'var(--zea-b3)', border: '1px solid var(--zea-b2)',
    borderRadius: 'var(--zea-rounded-btn)', color: 'var(--zea-bc)',
    fontSize: 15, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24, background: 'var(--zea-b3)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none',
          color: 'color-mix(in oklch, var(--zea-bc) 50%, transparent)',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
          marginBottom: 40, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ← Back
        </button>

        <div style={{ marginBottom: 36 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
            <img src="/icono-zea.svg" alt="ZEA" style={{ height: 28 }} />
            <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--zea-bc)' }}>Soma</span>
          </a>
          <h1 className="zea-heading-lg" style={{ marginBottom: 8 }}>Sign in to Soma</h1>
          <p className="zea-body-sm" style={{ color: 'color-mix(in oklch, var(--zea-bc) 40%, transparent)' }}>
            Use your ZEA Platform account to access the agent.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="zea-label-lg" style={{ display: 'block', marginBottom: 8, color: 'color-mix(in oklch, var(--zea-bc) 70%, transparent)' }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="c@zea.cl" required autoFocus style={inputStyle} />
            </div>
            <div>
              <label className="zea-label-lg" style={{ display: 'block', marginBottom: 8, color: 'color-mix(in oklch, var(--zea-bc) 70%, transparent)' }}>
                Password
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="········" required style={inputStyle} />
            </div>

            {error && (
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'color-mix(in oklch, var(--zea-er) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--zea-er) 20%, transparent)',
                color: 'oklch(70% 0.2 17)', fontSize: 13, lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="zea-btn zea-btn--primary zea-btn--md zea-btn--primary-shadow"
              style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </div>
        </form>

        <p style={{
          fontSize: 12, textAlign: 'center', marginTop: 28,
          color: 'color-mix(in oklch, var(--zea-bc) 25%, transparent)',
        }}>
          Test: c@zea.cl / 2Infinit0
        </p>
      </div>
    </div>
  )
}
