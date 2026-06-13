// ─── Südlich App.tsx — Refactored with @zea/soma-sdk ───

// ANTES (acoplado):
// import { ChatPanel } from './components/chat/ChatPanel'
// import { ChatPanelRpc } from './components/chat/ChatPanelRpc'

// AHORA (desacoplado con Soma SDK):
import { GliaChat, GliaCopilot } from '@zea/soma-sdk'

const RPC_AGENT_ID = '4c4e2791-026b-4508-a2c3-1580bf86b661'

// ... (rest of imports unchanged)

function GPLayout() {
  const [activeDM, setActiveDM] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const isChatOpen = !!activeDM

  return (
    <div className="flex min-h-screen antialiased overflow-hidden">
      <Sidebar ... />
      <main className="flex flex-1 flex-col min-h-screen min-w-0">
        <TopBar />
        <div className="flex-1 min-h-0 px-[var(--stitch-margin-page)] py-6 overflow-hidden">
          <Outlet />
        </div>
      </main>
      {isChatOpen && (
        <aside className="w-[520px] shrink-0 border-l flex flex-col h-screen sticky top-0">
          {/* AGENTE: usa GliaChat del SDK en vez de ChatPanelRpc */}
          <GliaChat
            agentId={RPC_AGENT_ID}
            conversationId={activeConversationId || `dm:${RPC_AGENT_ID}`}
            apiKey="zs_live_bootstrap_test_key_2026"
            baseUrl="http://soma.zea.localhost"
            welcomeMessage="¡Hola! Soy Full Stack Developer. Tengo acceso al código y datos de la plataforma."
          />
        </aside>
      )}
    </div>
  )
}

// Files page → uses GliaFileBrowser from SDK
function FilesPage() {
  const { files, loading } = useGliaFiles('zs_live_...', 'http://soma.zea.localhost')
  return <GliaFileBrowser files={files} loading={loading} />
}

// Skills page → uses GliaSkillEditor from SDK  
function SkillsManagement() {
  const { skills, loading, create, deleteSkill } = useGliaSkills('zs_live_...', 'http://soma.zea.localhost')
  return <GliaSkillEditor skills={skills} loading={loading} onCreate={create} onDelete={deleteSkill} />
}
