import { GliaChat } from '@zea/soma-sdk'

interface ChatViewProps {
  onLogout: () => void
}

const AGENT_ID = '4c4e2791-026b-4508-a2c3-1580bf86b661'

export default function ChatView({ onLogout }: ChatViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Topbar */}
      <header style={{
        height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid var(--zea-b3, #30363d)',
        background: 'var(--zea-b2, #161b22)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icono-zea.svg" alt="ZEA" style={{ height: 20 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Soma</span>
          <span style={{ color: 'var(--zea-bc-muted, #8b949e)', fontSize: 13 }}>/ Agent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#3fb950',
          }} title="Connected" />
          <button
            onClick={onLogout}
            className="zea-btn zea-btn--outline zea-btn--sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Chat area */}
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
