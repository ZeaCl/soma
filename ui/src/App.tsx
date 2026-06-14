import { useState, useEffect } from 'react'
import Landing from './Landing'
import ZeaLanding from './ZeaLanding'
import Login from './Login'
import ChatView from './ChatView'
import { exchangeCode } from './oauth'

type View = 'landing' | 'login' | 'chat' | 'callback'

function isZeaCl(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  // zea.cl or app.zea.cl (prod) or zea.localhost (dev) → platform landing
  // soma.zea.cl or soma.zea.localhost → agent landing
  const isPlatform = ['zea.cl', 'www.zea.cl', 'app.zea.cl', 'zea.localhost'].includes(host)
  const isAgent = host.startsWith('soma.')
  return isPlatform && !isAgent
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    if (localStorage.getItem('soma_token')) return 'chat'
    if (typeof window !== 'undefined' && window.location.search.includes('code=')) return 'callback'
    return 'landing'
  })
  const [error, setError] = useState('')

  // OAuth2 callback handler
  useEffect(() => {
    if (view !== 'callback') return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const errorParam = params.get('error')
    const verifier = sessionStorage.getItem('soma_pkce_verifier')

    if (errorParam) {
      setError(`Thalamus error: ${errorParam} — ${params.get('error_description') || ''}`)
      setView('landing')
      window.history.replaceState({}, '', '/')
      return
    }
    if (!code || !verifier) {
      setError(`Missing ${!code ? 'code' : 'verifier'}. Check sessionStorage.`)
      setView('landing')
      window.history.replaceState({}, '', '/')
      return
    }

    exchangeCode(code, verifier)
      .then(token => {
        localStorage.setItem('soma_token', token)
        sessionStorage.removeItem('soma_pkce_verifier')
        setView('chat')
        window.history.replaceState({}, '', '/')
      })
      .catch(err => {
        setError(`Token exchange failed: ${err.message}`)
        setView('landing')
        window.history.replaceState({}, '', '/')
      })
  }, [view])

  if (view === 'callback') return <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--zea-b3)', color: 'var(--zea-bc)',
    fontFamily: 'var(--zea-sans)', fontSize: 16,
  }}>Signing in...</div>

  if (view === 'chat') return <ChatView onLogout={() => {
    localStorage.removeItem('soma_token'); setView('landing')
  }} />
  if (view === 'login') return <Login />
  if (isZeaCl()) return <ZeaLanding onLogin={() => setView('login')} error={error} />
  return <Landing onLogin={() => setView('login')} error={error} />
}
