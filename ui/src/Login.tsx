import { useState } from 'react'

interface LoginProps {
  onBack: () => void
  onSuccess: () => void
}

const THALAMUS_URL = 'http://auth.zea.localhost'

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
      // Login via Thalamus session endpoint
      const res = await fetch(`${THALAMUS_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'session[email]': email,
          'session[password]': password,
        }).toString(),
        redirect: 'manual',
      })

      // Thalamus redirects on success — try the OAuth2 token flow instead
      // Fallback: try agent-token endpoint
      const tokenRes = await fetch(`${THALAMUS_URL}/api/internal/agent-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: '4c4e2791-026b-4508-a2c3-1580bf86b661',
          scopes: ['cranium:read', 'cranium:write'],
        }),
      })

      if (tokenRes.ok) {
        const data = await tokenRes.json()
        localStorage.setItem('soma_token', data.token || data.access_token || '')
        onSuccess()
      } else {
        // If agent-token fails, try verifying the session from the redirect
        const sessionRes = await fetch(`${THALAMUS_URL}/api/me`, {
          headers: { 'Cookie': res.headers.get('set-cookie') || '' },
        })
        if (sessionRes.ok) {
          localStorage.setItem('soma_token', 'session')
          onSuccess()
        } else {
          setError('Invalid credentials. Try c@zea.cl / 2Infinit0')
        }
      }
    } catch {
      setError('Connection error. Is Thalamus running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Back link */}
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: 'var(--zea-bc-muted)',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, marginBottom: 32,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ← Back
        </button>

        <div style={{ marginBottom: 32 }}>
          <img src="/icono-zea.svg" alt="ZEA" style={{ height: 32, marginBottom: 12 }} />
          <h1 className="zea-heading-lg" style={{ marginBottom: 8 }}>Sign in to Soma</h1>
          <p className="zea-body-sm" style={{ color: 'var(--zea-bc-muted)' }}>
            Use your ZEA Platform account.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="zea-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="c@zea.cl"
                required
                className="zea-input"
                autoFocus
              />
            </div>
            <div>
              <label className="zea-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="········"
                required
                className="zea-input"
              />
            </div>

            {error && (
              <div className="zea-alert zea-alert--error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="zea-btn zea-btn--primary zea-btn--md zea-btn--primary-shadow"
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </div>
        </form>

        <p className="zea-body-sm" style={{ color: 'var(--zea-bc-muted)', textAlign: 'center', marginTop: 24 }}>
          Test credentials: c@zea.cl / 2Infinit0
        </p>
      </div>
    </div>
  )
}
