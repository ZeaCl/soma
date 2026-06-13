import { GliaChat } from '@zea/soma-sdk'

interface ChatViewProps { onLogout: () => void }
const AGENT_ID = '4c4e2791-026b-4508-a2c3-1580bf86b661'

export default function ChatView({ onLogout }: ChatViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--zea-b3)' }}>
      {/* Topbar */}
      <header style={{
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid var(--zea-b2)',
        background: 'var(--zea-b3)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icono-zea.svg" alt="ZEA" style={{ height: 20 }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--zea-bc)' }}>Soma</span>
          <span style={{ color: 'color-mix(in oklch, var(--zea-bc) 35%, transparent)', fontSize: 13 }}>/ Agent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#3fb950',
            boxShadow: '0 0 6px #3fb950',
          }} />
          <button onClick={onLogout} className="zea-btn zea-btn--ghost zea-btn--sm">
            Sign Out
          </button>
        </div>
      </header>

      {/* Chat */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <GliaChat
          agentId={AGENT_ID}
          welcomeMessage="¡Hola! Soy tu agente de ZEA Platform. Puedo ayudarte con código, datos, análisis, y más. ¿En qué querés trabajar hoy?"
          placeholder="Escribe un mensaje..."
        />
      </div>
    </div>
  )
}
