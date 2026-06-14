interface LandingProps { onLogin: () => void; error?: string }

const muted = 'color-mix(in oklch, var(--zea-bc) 50%, transparent)'
const subtle = 'color-mix(in oklch, var(--zea-bc) 35%, transparent)'
const border = '1px solid color-mix(in oklch, white 5%, transparent)'
const borderTop = border

export default function ZeaLanding({ onLogin, error }: LandingProps) {
  return (
    <div style={{ background: 'var(--zea-b3)', minHeight: '100vh' }}>
      {error && (
        <div style={{
          background: 'color-mix(in oklch, var(--zea-er) 15%, transparent)',
          borderBottom: '1px solid color-mix(in oklch, var(--zea-er) 30%, transparent)',
          color: 'oklch(70% 0.2 17)', padding: '12px 24px', fontSize: 13, textAlign: 'center',
        }}>⚠️ {error}</div>
      )}

      {/* Navbar */}
      <header style={{ background:'var(--zea-b3)', borderBottom:'1px solid var(--zea-b3)', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <a href="/" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <img src="/icono-zea.svg" alt="ZEA" style={{ height:20, filter:'brightness(0) invert(1) brightness(0.675)' }} />
            <img src="/text-zea.svg" alt="" style={{ height:16, filter:'brightness(0) invert(1) brightness(0.675)' }} />
          </a>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <a href="https://docs.zea.dev" target="_blank" style={{ fontSize:13, fontWeight:500, color:muted }}>Docs</a>
            <a href="https://github.com/ZeaCl" target="_blank"
              style={{ color:muted, display:'flex', alignItems:'center', textDecoration:'none' }}
              title="Open source on GitHub">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
            <a href="https://docs.zea.dev" target="_blank" style={{ fontSize:13, fontWeight:500, color:muted }}>Docs</a>
            <button onClick={onLogin} className="zea-btn zea-btn--primary zea-btn--sm"
              style={{ fontSize:12, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.03em' }}>
              Launch Platform
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ minHeight:'90vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px 120px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'15%', left:'5%', width:500, height:500, borderRadius:'50%', background:'color-mix(in oklch, var(--zea-p) 8%, transparent)', filter:'blur(140px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'20%', right:'5%', width:400, height:400, borderRadius:'50%', background:'color-mix(in oklch, #7c3aed 8%, transparent)', filter:'blur(140px)', pointerEvents:'none' }} />

        <div style={{ maxWidth:900, width:'100%', margin:'0 auto', position:'relative', zIndex:10, textAlign:'center' }}>
          <h1 style={{ fontSize:'clamp(2.5rem, 6vw, 4.5rem)', fontWeight:800, lineHeight:1.08, letterSpacing:'-0.03em', marginBottom:24 }}>
            Empower your{' '}
            <span className="zea-gradient-text">organization</span>
            {' '}or platform in seconds
          </h1>
          <p style={{ fontSize:'clamp(1rem, 2.2vw, 1.2rem)', lineHeight:1.7, color:muted, maxWidth:650, margin:'0 auto 48px' }}>
            AI gateway, agents, workflows, messaging, and payments — 
            one platform, one login, one SDK.
          </p>

          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:80 }}>
            <button onClick={onLogin} className="zea-btn zea-btn--primary zea-btn--md zea-btn--primary-shadow"
              style={{ fontSize:14, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.04em', padding:'14px 36px' }}>
              Launch Platform
            </button>
            <button onClick={() => window.open('https://docs.zea.dev', '_blank')}
              className="zea-btn zea-btn--ghost zea-btn--md"
              style={{ fontSize:14, fontWeight:600, padding:'14px 36px', border }}>
              Read the Docs
            </button>
          </div>

          {/* Services grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16, textAlign:'left' }}>
            {services.map(s => (
              <div key={s.name} style={{
                padding:'24px', borderRadius:14, border,
                background:'color-mix(in oklch, var(--zea-b2) 30%, transparent)',
                transition:'background .2s',
              }}>
                <div style={{ fontSize:28, marginBottom:12 }}>{s.icon}</div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>{s.name}</div>
                <div style={{ fontSize:12.5, color:muted, lineHeight:1.6 }}>{s.desc}</div>
                <div style={{ marginTop:12, display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ padding:'2px 8px', borderRadius:6, background:s.ready ? 'color-mix(in oklch, #3fb950 10%, transparent)' : 'color-mix(in oklch, #fbbf24 10%, transparent)', color:s.ready ? '#3fb950' : '#fbbf24', fontSize:10, fontWeight:600 }}>
                    {s.ready ? 'Live' : 'Soon'}
                  </span>
                  <span style={{ fontSize:10, color:subtle, fontFamily:'"SF Mono",monospace' }}>{s.sdk}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding:'120px 24px', borderTop }}>
        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontSize:'clamp(1.8rem, 4vw, 2.5rem)', fontWeight:700, marginBottom:16 }}>
            One platform, every service
          </h2>
          <p style={{ fontSize:16, color:muted, maxWidth:600, margin:'0 auto 64px', lineHeight:1.7 }}>
            Each service has its own SDK, its own API, and its own landing page.
            But they all share the same identity, the same auth, and the same internal site.
          </p>
        </div>
        <div style={{ maxWidth:900, margin:'0 auto', display:'grid', gap:24 }}>
          {howItWorks.map((item, i) => (
            <div key={i} style={{ display:'flex', gap:20, padding:'24px', borderRadius:14, border, background:'color-mix(in oklch, var(--zea-b2) 20%, transparent)' }}>
              <div style={{ fontSize:24, flexShrink:0, width:48, height:48, borderRadius:12, background:`color-mix(in oklch, ${item.accent} 12%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center' }}>{item.icon}</div>
              <div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{item.title}</div>
                <div style={{ fontSize:13, color:muted, lineHeight:1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:'120px 24px', borderTop, background:'color-mix(in oklch, var(--zea-b2) 30%, transparent)', textAlign:'center' }}>
        <h2 style={{ fontSize:'clamp(1.8rem, 4vw, 2.5rem)', fontWeight:700, marginBottom:16 }}>
          Start building today
        </h2>
        <p style={{ fontSize:16, color:muted, maxWidth:500, margin:'0 auto 40px', lineHeight:1.7 }}>
          One login. One SDK. Every service.
        </p>
        <button onClick={onLogin} className="zea-btn zea-btn--primary zea-btn--lg zea-btn--primary-shadow"
          style={{ fontSize:15, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.04em', padding:'16px 48px' }}>
          Launch Platform →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ borderTop, padding:'48px 24px', color:'color-mix(in oklch, var(--zea-bc) 30%, transparent)', fontSize:13 }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <span>© 2026 ZEA Platform</span>
          <span>AI Gateway · Workflows · Agent Hub · Messages · Payments</span>
        </div>
      </footer>
    </div>
  )
}

const services = [
  { icon:'🧠', name:'Agent Hub', desc:'Deploy AI agents as Linux users with kernel-level isolation. Pi, ReAct, OpenCode — choose any engine per agent.', sdk:'@zea/soma-sdk', ready:true },
  { icon:'🔄', name:'Workflows', desc:'Long-running autonomous workflows. Chain agents, process data, and orchestrate complex tasks with Cerebelum.', sdk:'@zea/cerebelum-sdk', ready:true },
  { icon:'💬', name:'Messages', desc:'Real-time messaging between users and agents. WebSocket-native, typing indicators, @mentions, channels.', sdk:'@zea/synapse-sdk', ready:true },
  { icon:'🤖', name:'AI Gateway', desc:'Single endpoint for all AI models. DeepSeek, OpenAI, Claude — switch models without changing code.', sdk:'@zea/gateway-sdk', ready:true },
  { icon:'💳', name:'Payments', desc:'Subscription billing, invoicing, and payment processing for your platform. Stripe-native, multi-currency.', sdk:'@zea/payments-sdk', ready:false },
]

const howItWorks = [
  { icon:'🔐', accent:'var(--zea-p)', title:'One identity for everything', desc:'Thalamus provides OAuth2, JWT, API keys, and organization management for all services. Users, agents, and services authenticate the same way.' },
  { icon:'📦', accent:'#7c3aed', title:'Independent services, shared core', desc:'Each service has its own codebase, its own Docker container, and its own API. They share the database, the auth, and the internal site.' },
  { icon:'🧩', accent:'#22d3ee', title:'One SDK per service, one CLI', desc:'Install only what you need. @zea/soma-sdk for agents, @zea/cerebelum-sdk for workflows. Or use the unified CLI: zea agent create, zea workflow run.' },
  { icon:'🏢', accent:'#fbbf24', title:'Multi-tenant by default', desc:'Organizations, teams, and permissions are built-in. API keys are scoped per org. Agents are isolated at the kernel level with chmod 700.' },
]
