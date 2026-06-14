import { useState, useMemo } from 'react'
import { GliaChat } from '@zea/soma-sdk'

interface ChatViewProps { onLogout: () => void }
const HANDLE = 4

const B1='var(--zea-b1)', B2='var(--zea-b2)', B3='var(--zea-b3)', BC='var(--zea-bc)'
const BM='color-mix(in oklch, var(--zea-bc) 50%, transparent)'
const BS='color-mix(in oklch, var(--zea-bc) 35%, transparent)'
const BW='1px solid color-mix(in oklch, white 5%, transparent)'

export default function ChatView({ onLogout }: ChatViewProps) {
  const [sidebarW, setSidebarW] = useState(() => {
    try { return Number(localStorage.getItem('soma:sidebar') || 240) } catch { return 240 }
  })
  const [chatW, setChatW] = useState(() => {
    try { return Number(localStorage.getItem('soma:chat') || 420) } catch { return 420 }
  })
  const [activeItem, setActiveItem] = useState('home')
  const [chatVisible, setChatVisible] = useState(true)

  const agentId = useMemo(() => getAgentId(), [])
  const agentKey = agentId || 'agent'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${sidebarW}px ${HANDLE}px 1fr ${HANDLE}px ${chatVisible ? chatW : 0}px`,
      height: '100vh', width: '100vw', overflow: 'hidden',
      background: B3, color: BC, fontFamily: 'var(--zea-sans)', fontSize: 14,
    }}>
      <Sidebar active={activeItem} onSelect={setActiveItem} onLogout={onLogout} />
      <Handle persist="soma:sidebar" w={sidebarW} setW={setSidebarW} min={180} max={400} />
      <Main active={activeItem} chatVisible={chatVisible} onToggleChat={() => setChatVisible(v => !v)} />
      {chatVisible && <Handle persist="soma:chat" w={chatW} setW={setChatW} min={300} max={700} dir={-1} />}
      {!chatVisible && <div />}
      {chatVisible && (
        <aside style={{ overflow:'hidden', borderLeft: BW }}>
          <GliaChat key={agentId || 'default-agent'} agentId={agentId} />
        </aside>
      )}
      {!chatVisible && <div />}
    </div>
  )
}

// ── Sidebar ──
function Sidebar({ active, onSelect, onLogout }: { active: string; onSelect: (id: string) => void; onLogout: () => void }) {
  const sections = [
    { label: 'MANAGEMENT', items: [
      { id:'users', icon:'👥', label:'Users/Agents' },
      { id:'orgs', icon:'🏢', label:'Organizations' },
      { id:'apikeys', icon:'🔑', label:'API Keys' },
    ]},
    { label: 'WORKSPACE', items: [
      { id:'files', icon:'📁', label:'Files' },
      { id:'skills', icon:'🧠', label:'Skills' },
      { id:'workflows', icon:'🔄', label:'Workflows' },
    ]},
    { label: 'MESSAGES', items: [
      { id:'ch-general', icon:'#', label:'general', indent:0 },
      { id:'ch-general-dev', icon:'#', label:'general-dev', indent:0 },
      { id:'ch-deploy', icon:'#', label:'deploy', indent:0 },
    ]},
    { label: 'DIRECT MSGS', items: [
      { id:'dm-fullstack', icon:'💬', label:'Full Stack Dev', online:true },
      { id:'dm-reviewer', icon:'💬', label:'Code Reviewer', online:true },
      { id:'dm-analyst', icon:'💬', label:'Data Analyst', online:false },
      { id:'dm-camila', icon:'💬', label:'Agent Alpha', online:false },
    ]},
  ]

  return (
    <aside style={{ display:'flex', flexDirection:'column', height:'100%', background:B2, overflow:'hidden' }}>
      <a href="/" style={{ display:'flex', alignItems:'center', gap:6, padding:'14px 16px', borderBottom:BW, flexShrink:0 }}>
        <img src="/icono-zea.svg" alt="ZEA" style={{ height:18, filter:'brightness(0) invert(1) brightness(0.675)' }} />
        <img src="/text-zea.svg" alt="" style={{ height:14, filter:'brightness(0) invert(1) brightness(0.675)' }} />
      </a>
      <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
        {sections.map(s => (
          <div key={s.label}>
            <div style={{ padding:'14px 16px 4px', fontSize:10, fontWeight:600, color:BS, letterSpacing:'0.06em', textTransform:'uppercase' }}>
              {s.label}
            </div>
            {s.items.map(i => (
              <button key={i.id} onClick={() => onSelect(i.id)} style={{
                display:'flex', alignItems:'center', gap:8, width:'100%',
                padding:'6px 16px', border:'none',
                background: active===i.id ? 'color-mix(in oklch, var(--zea-p) 12%, transparent)' : 'transparent',
                color: active===i.id ? 'var(--zea-p)' : i.label.startsWith('#') ? 'oklch(70% 0.15 200)' : BM,
                borderLeft: active===i.id ? '2px solid var(--zea-p)' : '2px solid transparent',
                cursor:'pointer', fontSize:13, fontFamily:'inherit', textAlign:'left',
              }}>
                <span style={{ fontSize:14, width:20, textAlign:'center', flexShrink:0 }}>{i.icon}</span>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{i.label}</span>
                {'online' in i && <span style={{ width:8, height:8, borderRadius:'50%', background:i.online ? '#3fb950' : '#484f58', flexShrink:0 }} />}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ borderTop:BW, padding:'10px 16px', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:B1, color:BM, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>CH</div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>User</div>
          <div style={{ fontSize:10, color:BS }}>Developer</div>
        </div>
        <button onClick={onLogout} style={{ background:'none', border:'none', color:BS, cursor:'pointer', fontSize:13, padding:2 }}>🚪</button>
      </div>
    </aside>
  )
}

// ── Content ──
function Main({ active, chatVisible, onToggleChat }: { active: string; chatVisible: boolean; onToggleChat: () => void }) {
  return (
    <main style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', minWidth:0 }}>
      <header style={{
        height:48, padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between',
        borderBottom:BW, background:B3, flexShrink:0, fontSize:13,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src="/icono-zea.svg" alt="" style={{ height:14, filter:'brightness(0) invert(1) brightness(0.675)' }} />
          <span style={{ color:BM, fontWeight:500 }}>Agents Hub</span>
          {active !== 'home' && <><span style={{ color:BS }}>/</span><span style={{ color:BC, fontWeight:500 }}>{itemLabel(active)}</span></>}
        </div>
        <button onClick={onToggleChat} className="zea-btn zea-btn--ghost zea-btn--sm" style={{ fontSize:11 }}>
          {chatVisible ? 'Hide Chat' : 'Chat'}
        </button>
      </header>

      <div style={{ flex:1, overflowY:'auto', background:'#fafafa', color:'#24292f' }}>
        <div style={{ padding:'40px 32px', maxWidth:720 }}>
          <SectionHeader>👋 Welcome to Agents Hub</SectionHeader>
          <Description>
            Infraestructura cloud para crear y ejecutar agentes de IA autónomos.
            Sin construir orquestación ni sandboxes desde cero.
          </Description>

          <SectionHeader style={{ marginTop:40 }}>📋 Get Started</SectionHeader>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {steps.map((s, i) => (
              <Step key={i} num={i+1} title={s.title} desc={s.desc} />
            ))}
          </div>

          <div style={{ marginTop:40, padding:'20px 24px', background:'#f6f8fa', borderRadius:10, border:'1px solid #d0d7de' }}>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>También podés:</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13, color:'#656d76' }}>
              {also.map(a => <div key={a} style={{ display:'flex', gap:8 }}><span>{a}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

// ── Handle ──
function Handle({ persist, w, setW, min, max, dir = 1 }: { persist:string; w:number; setW:(v:number)=>void; min:number; max:number; dir?:1|-1 }) {
  const onDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const sx = e.clientX, sw = w
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const move = (ev: MouseEvent) => { setW(Math.min(max, Math.max(min, sw + (ev.clientX - sx) * dir))) }
    const up = () => {
      document.body.style.cursor = ''; document.body.style.userSelect = ''
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up)
      try { localStorage.setItem(persist, String(w)) } catch {}
    }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up)
  }
  return <div onMouseDown={onDown} style={{ cursor:'col-resize', background:'var(--zea-b2)', zIndex:10, transition:'background .15s' }}
    onMouseEnter={e => e.currentTarget.style.background='var(--zea-p)'}
    onMouseLeave={e => e.currentTarget.style.background='var(--zea-b2)'} />
}

// ── Helpers ──
function SectionHeader({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <h1 style={{ fontSize:22, fontWeight:700, marginBottom:8, ...style }}>{children}</h1>
}
function Description({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize:15, color:'#656d76', lineHeight:1.6 }}>{children}</p>
}
function Step({ num, title, desc }: { num:number; title:string; desc:string }) {
  return (
    <div style={{ display:'flex', gap:16, alignItems:'flex-start', padding:'16px 0', borderBottom:'1px solid #d0d7de' }}>
      <div style={{ width:36, height:36, borderRadius:10, background:'var(--zea-b1)', color:'var(--zea-p)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, flexShrink:0, border:'1px solid color-mix(in oklch, var(--zea-p) 20%, transparent)' }}>
        {num}
      </div>
      <div>
        <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:13, color:'#656d76' }}>{desc}</div>
      </div>
    </div>
  )
}

const steps = [
  { title:'Generate an API Key', desc:'Create an API key from the MANAGEMENT section to authenticate your agents and tools.' },
  { title:'Create your first Agent', desc:'Each agent is a platform user. Go to Users/Agents and create one with a mission and skills.' },
  { title:'Assign Skills', desc:'Browse the Skills catalog and assign domain-specific capabilities to your agent.' },
  { title:'Start a Conversation', desc:'Click on your agent in DIRECT MSGS and start chatting. The agent will use its assigned skills.' },
]

const also = [
  '🔄 Lanzar workflows de larga duración con Cerebelum',
  '📁 Subir y gestionar archivos en el workspace',
  '🧠 Crear skills personalizadas para tus agentes',
  '🏢 Gestionar múltiples organizaciones multi-tenant',
]

function itemLabel(id: string): string {
  const map: Record<string, string> = {
    users:'Users/Agents', orgs:'Organizations', apikeys:'API Keys',
    files:'Files', skills:'Skills', workflows:'Workflows',
    home:'Home',
  }
  return map[id] || id
}

// ── Agent ID from JWT ──
function getAgentId(): string {
  try {
    const token = localStorage.getItem('soma_token')
    if (!token) return ''
    const payload = JSON.parse(atob(token.split('.')[1]))
    // Thalamus JWT: sub = "user_<uuid>"
    return (payload.sub || '').replace(/^user_/, '')
  } catch { return '' }
}
