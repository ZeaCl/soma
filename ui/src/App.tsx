import { useState, useEffect } from 'react'
import Landing from './Landing'
import Login from './Login'
import ChatView from './ChatView'

type View = 'landing' | 'login' | 'chat'

export default function App() {
  const [view, setView] = useState<View>('landing')

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('soma_token')
    if (token) setView('chat')
  }, [])

  if (view === 'chat') return <ChatView onLogout={() => { localStorage.removeItem('soma_token'); setView('landing') }} />
  if (view === 'login') return <Login onBack={() => setView('landing')} onSuccess={() => setView('chat')} />
  return <Landing onLogin={() => setView('login')} />
}
