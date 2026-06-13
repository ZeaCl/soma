interface LandingProps { onLogin: () => void; error?: string }

const muted = 'color-mix(in oklch, var(--zea-bc) 50%, transparent)'
const subtle = 'color-mix(in oklch, var(--zea-bc) 35%, transparent)'
const border = '1px solid color-mix(in oklch, white 5%, transparent)'

export default function Landing({ onLogin, error }: LandingProps) {
  return (
    <div style={{ background: 'var(--zea-b3)', minHeight: '100vh' }}>
      {error && (
        <div style={{
          background: 'color-mix(in oklch, var(--zea-er) 15%, transparent)',
          borderBottom: '1px solid color-mix(in oklch, var(--zea-er) 30%, transparent)',
          color: 'oklch(70% 0.2 17)', padding: '12px 24px',
          fontSize: 13, textAlign: 'center',
        }}>
          ⚠️ {error}
        </div>
      )}
      {/* ── Navbar ── */}
      <header style={{
        background: 'var(--zea-b3)', borderBottom: '1px solid var(--zea-b3)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="/icono-zea.svg" alt="ZEA"
              style={{ height: 20, filter: 'brightness(0) invert(1) brightness(0.675)' }} />
            <img src="/text-zea.svg" alt=""
              style={{ height: 16, filter: 'brightness(0) invert(1) brightness(0.675)' }} />
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="https://docs.zea.dev" target="_blank"
              style={{ fontSize: 13, fontWeight: 500, color: muted }}>
              Docs
            </a>
            <button onClick={onLogin}
              className="zea-btn zea-btn--primary zea-btn--sm"
              style={{ fontSize: 12, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>
              Launch AgentHub
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        minHeight: '90vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px 120px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Blur glows */}
        <div style={{ position:'absolute', top:'15%', left:'5%', width:500, height:500, borderRadius:'50%', background:'color-mix(in oklch, var(--zea-p) 8%, transparent)', filter:'blur(140px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'20%', right:'5%', width:400, height:400, borderRadius:'50%', background:'color-mix(in oklch, #7c3aed 8%, transparent)', filter:'blur(140px)', pointerEvents:'none' }} />

        <div style={{ maxWidth:1100, width:'100%', margin:'0 auto', position:'relative', zIndex:10, textAlign:'center' }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8,
            padding:'4px 16px', borderRadius:20,
            background:'color-mix(in oklch, var(--zea-p) 10%, transparent)',
            border:'1px solid color-mix(in oklch, var(--zea-p) 20%, transparent)',
            fontSize:12, fontWeight:500, color:'var(--zea-p)',
            marginBottom:32,
          }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--zea-p)', animation:'cranium-pulse 1.5s ease-in-out infinite' }} />
            Multi-engine · OS sandboxes · CLI-first
          </div>

          <h1 style={{
            fontSize:'clamp(2.5rem, 6vw, 4.5rem)', fontWeight:800,
            lineHeight:1.08, letterSpacing:'-0.03em', marginBottom:24,
            maxWidth:850, margin:'0 auto 24px',
          }}>
            Agents that run{' '}
            <span className="zea-gradient-text">like users</span>
            {' '}on your infrastructure
          </h1>
          <p style={{
            fontSize:'clamp(1rem, 2.2vw, 1.2rem)', lineHeight:1.7, color:muted,
            maxWidth:650, margin:'0 auto 48px',
          }}>
            Each agent gets its own Linux user, isolated home directory, and kernel-enforced sandbox.
            Deploy Pi, ReAct, OpenCode or any engine — one CLI, one API, zero friction.
          </p>

          <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:80 }}>
            <button onClick={onLogin}
              className="zea-btn zea-btn--primary zea-btn--md zea-btn--primary-shadow"
              style={{ fontSize:14, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.04em', padding:'14px 36px' }}>
              Launch AgentHub
            </button>
            <button onClick={() => window.open('https://docs.zea.dev/soma', '_blank')}
              className="zea-btn zea-btn--ghost zea-btn--md"
              style={{ fontSize:14, fontWeight:600, padding:'14px 36px', border }}>
              Read the Docs
            </button>
          </div>

          {/* ── Terminal preview (CLI) ── */}
          <div style={{
            maxWidth:720, margin:'0 auto',
            background:'color-mix(in oklch, #0d1117 95%, transparent)',
            borderRadius:16, border:'1px solid color-mix(in oklch, white 10%, transparent)',
            boxShadow:'0 30px 60px -15px rgb(0 0 0 / 0.7)',
            overflow:'hidden', backdropFilter:'blur(12px)',
            textAlign:'left',
          }}>
            <div style={{
              padding:'10px 16px', background:'#161b22',
              borderBottom:'1px solid color-mix(in oklch, white 5%, transparent)',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:'#ff5f56' }} />
              <span style={{ width:10, height:10, borderRadius:'50%', background:'#ffbd2e' }} />
              <span style={{ width:10, height:10, borderRadius:'50%', background:'#27c93f' }} />
              <span style={{ fontSize:11, color:'color-mix(in oklch, white 30%, transparent)', fontFamily:'"SF Mono","Fira Code",monospace', marginLeft:8 }}>
                terminal — soma-agent
              </span>
            </div>
            <div style={{
              padding:'20px 24px', fontFamily:'"SF Mono","Fira Code",monospace',
              fontSize:12.5, lineHeight:1.85, color:'color-mix(in oklch, white 80%, transparent)',
              overflowX:'auto',
            }}>
              <div><span style={{ color:'#22d3ee' }}>$</span> soma-agent agent create \</div>
              <div style={{ paddingLeft:20 }}>--name <span style={{ color:'#a78bfa' }}>"Financial Analyst"</span> \</div>
              <div style={{ paddingLeft:20 }}>--engine <span style={{ color:'#fbbf24' }}>pi</span> \</div>
              <div style={{ paddingLeft:20 }}>--system-prompt <span style={{ color:'#a78bfa' }}>"Eres analista cuantitativo..."</span> \</div>
              <div style={{ paddingLeft:20 }}>--tools <span style={{ color:'#fbbf24' }}>read,bash,edit,write</span> \</div>
              <div style={{ paddingLeft:20 }}>--skills <span style={{ color:'#fbbf24' }}>xlsx,venture</span> \</div>
              <div style={{ paddingLeft:20 }}>--mount <span style={{ color:'#a78bfa' }}>/workspace/orgs/org-1/shared</span>:<span style={{ color:'#6ee7b7' }}>shared</span></div>
              <div style={{ marginTop:8 }} />
              <div style={{ color:'#3fb950' }}>✅ Agent created: c4e2791b-026b-4508-a2c3-1580bf86b661</div>
              <div style={{ color:'#3fb950' }}>✅ Linux user: soma-c4e2791b-0 (uid=2001)</div>
              <div style={{ color:'#3fb950' }}>✅ Home: /home/soma/c4e2791b-... (chmod 700)</div>
              <div style={{ color:'#3fb950' }}>✅ Mount: /workspace/orgs/org-1/shared → shared (rw)</div>
              <div style={{ marginTop:12 }} />
              <div><span style={{ color:'#22d3ee' }}>$</span> soma-agent conversation chat c4e2791b</div>
              <div style={{ color:muted }}>🧠 Chat with Financial Analyst (pi) — Ctrl+D to exit</div>
              <div style={{ marginTop:4 }} />
              <div><span style={{ color:'#818cf8' }}>▶</span> <span style={{ color:'var(--zea-bc)' }}>Analizá el portfolio de Fund II Q1 2026</span></div>
              <div style={{ marginTop:4 }}>
                <span style={{ color:'#a78bfa' }}>🤖</span>{' '}
                <span style={{ display:'inline-block', width:6, height:13, background:muted, animation:'cranium-pulse 1s infinite', verticalAlign:'middle', borderRadius:2 }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: How it works ── */}
      <section style={{ padding:'120px 24px', borderTop:border }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <h2 style={{
            fontSize:'clamp(1.8rem, 4vw, 2.5rem)', fontWeight:700,
            textAlign:'center', marginBottom:16,
          }}>
            How it works
          </h2>
          <p style={{
            fontSize:16, color:muted, textAlign:'center', maxWidth:600,
            margin:'0 auto 64px', lineHeight:1.7,
          }}>
            Each agent is a real Linux user with an isolated home directory.
            The kernel enforces access — not application code.
          </p>

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
            gap:24,
          }}>
            {howItWorks.map((item, i) => (
              <div key={i} style={{
                padding:32, borderRadius:16, border,
                background:'color-mix(in oklch, var(--zea-b2) 30%, transparent)',
              }}>
                <div style={{
                  width:48, height:48, borderRadius:12, marginBottom:20,
                  background:`color-mix(in oklch, ${item.accent} 12%, transparent)`,
                  border:`1px solid color-mix(in oklch, ${item.accent} 20%, transparent)`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:22,
                }}>
                  {item.icon}
                </div>
                <h3 style={{ fontSize:17, fontWeight:700, marginBottom:10 }}>{item.title}</h3>
                <p style={{ fontSize:13.5, color:muted, lineHeight:1.65 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section: For Developers (DX) ── */}
      <section style={{ padding:'120px 24px', borderTop:border }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'4px 14px', borderRadius:20,
              background:'color-mix(in oklch, #22d3ee 10%, transparent)',
              border:'1px solid color-mix(in oklch, #22d3ee 20%, transparent)',
              fontSize:11, fontWeight:600, color:'#22d3ee',
              marginBottom:20, textTransform:'uppercase', letterSpacing:'0.06em',
            }}>
              Developer Experience
            </div>
            <h2 style={{ fontSize:'clamp(1.8rem, 4vw, 2.5rem)', fontWeight:700, marginBottom:16 }}>
              Built for the terminal
            </h2>
            <p style={{ fontSize:16, color:muted, maxWidth:600, margin:'0 auto', lineHeight:1.7 }}>
              One command to create, configure, and chat with agents.
              No YAML, no dashboard — just your shell.
            </p>
          </div>

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
            gap:24, marginBottom:64,
          }}>
            {dxFeatures.map((f, i) => (
              <div key={i} style={{
                padding:28, borderRadius:14, border,
                background:'color-mix(in oklch, var(--zea-b2) 20%, transparent)',
              }}>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:6, fontFamily:'"SF Mono","Fira Code",monospace', color:f.color }}>
                  {f.cmd}
                </div>
                <div style={{ fontSize:13, color:muted, lineHeight:1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Code example */}
          <div style={{
            maxWidth:720, margin:'0 auto',
            background:'#0d1117', borderRadius:14, border:'1px solid #21262d',
            overflow:'hidden',
          }}>
            <div style={{
              padding:'10px 16px', background:'#161b22', borderBottom:'1px solid #21262d',
              fontSize:11, color:'#8b949e', fontFamily:'"SF Mono","Fira Code",monospace',
            }}>
              CI/CD — ephemeral agent for tests
            </div>
            <div style={{
              padding:'18px 22px', fontFamily:'"SF Mono","Fira Code",monospace',
              fontSize:12.5, lineHeight:1.85, color:'#e6edf3', overflowX:'auto',
            }}>
              <div><span style={{ color:'#8b949e' }}># Create ephemeral agent for PR checks</span></div>
              <div><span style={{ color:'#ff7b72' }}>AGENT</span>=<span style={{ color:'#79c0ff' }}>$(</span>soma-agent agent create \</div>
              <div style={{ paddingLeft:24 }}>--name <span style={{ color:'#a5d6ff' }}>"PR-{'{'}GITHUB_REF{'}'}"</span> \</div>
              <div style={{ paddingLeft:24 }}>--engine pi --tools read,bash \</div>
              <div style={{ paddingLeft:24 }}>--mount <span style={{ color:'#a5d6ff' }}>.</span>:workspace \</div>
              <div style={{ paddingLeft:24 }}>--ttl 1h --json | jq -r .id<span style={{ color:'#79c0ff' }}>)</span></div>
              <div style={{ marginTop:4 }} />
              <div><span style={{ color:'#8b949e' }}># Run lint + test as the agent</span></div>
              <div>soma-agent agent sandbox exec <span style={{ color:'#ff7b72' }}>$AGENT</span> \</div>
              <div style={{ paddingLeft:24 }}><span style={{ color:'#a5d6ff' }}>"cd workspace && npm ci && npm test"</span></div>
              <div style={{ marginTop:4 }} />
              <div><span style={{ color:'#8b949e' }}># Clean up</span></div>
              <div>soma-agent agent destroy <span style={{ color:'#ff7b72' }}>$AGENT</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: For Companies (Scale) ── */}
      <section style={{ padding:'120px 24px', borderTop:border }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8,
              padding:'4px 14px', borderRadius:20,
              background:'color-mix(in oklch, #3fb950 10%, transparent)',
              border:'1px solid color-mix(in oklch, #3fb950 20%, transparent)',
              fontSize:11, fontWeight:600, color:'#3fb950',
              marginBottom:20, textTransform:'uppercase', letterSpacing:'0.06em',
            }}>
              Enterprise Scale
            </div>
            <h2 style={{ fontSize:'clamp(1.8rem, 4vw, 2.5rem)', fontWeight:700, marginBottom:16 }}>
              Agents that scale with your org
            </h2>
            <p style={{ fontSize:16, color:muted, maxWidth:600, margin:'0 auto', lineHeight:1.7 }}>
              Kernel-level isolation means security by default.
              Multi-tenant, multi-team, multi-engine — grow without fear.
            </p>
          </div>

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))',
            gap:24,
          }}>
            {enterpriseFeatures.map((f, i) => (
              <div key={i} style={{
                padding:32, borderRadius:16, border,
                background:'color-mix(in oklch, var(--zea-b2) 30%, transparent)',
                textAlign:'center',
              }}>
                <div style={{ fontSize:36, marginBottom:16 }}>{f.icon}</div>
                <h3 style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>{f.title}</h3>
                <p style={{ fontSize:13, color:muted, lineHeight:1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Architecture diagram */}
          <div style={{
            marginTop:64, padding:32, borderRadius:16, border,
            background:'color-mix(in oklch, var(--zea-b2) 20%, transparent)',
            fontFamily:'"SF Mono","Fira Code",monospace', fontSize:12,
            color:muted, lineHeight:1.8, overflowX:'auto',
          }}>
            <div style={{ color:'var(--zea-bc)', fontWeight:600, marginBottom:16, fontSize:13 }}>
              /home/soma/
            </div>
            <div style={{ paddingLeft:16 }}>
              <span style={{ color:'#79c0ff' }}>drwx------</span>  soma-finance   finance/     <span style={{ color:'#8b949e' }}>← uid=2001, solo el agente</span>
            </div>
            <div style={{ paddingLeft:32 }}>
              <span style={{ color:'#79c0ff' }}>drwx------</span>  soma-finance   workspace/    <span style={{ color:'#8b949e' }}>← trabajo privado</span>
            </div>
            <div style={{ paddingLeft:32 }}>
              <span style={{ color:'#79c0ff' }}>drwxrwx---</span>  soma-finance   shared/       <span style={{ color:'#8b949e' }}>← grupo org-1 (rw)</span>
            </div>
            <div style={{ paddingLeft:32 }}>
              <span style={{ color:'#79c0ff' }}>dr-xr-xr--</span>  soma-finance   market-data/  <span style={{ color:'#8b949e' }}>← bind mount (ro)</span>
            </div>
            <div style={{ marginTop:4 }} />
            <div>
              <span style={{ color:'#79c0ff' }}>drwx------</span>  soma-reviewer  reviewer/     <span style={{ color:'#8b949e' }}>← uid=2002, aislado</span>
            </div>
            <div style={{ paddingLeft:32 }}>
              <span style={{ color:'#79c0ff' }}>drwx------</span>  soma-reviewer  workspace/
            </div>
            <div style={{ paddingLeft:32 }}>
              <span style={{ color:'#79c0ff' }}>drwxrwx---</span>  soma-reviewer  shared/       <span style={{ color:'#8b949e' }}>← mismo grupo, mismo volumen</span>
            </div>
            <div style={{ marginTop:12, color:'#3fb950' }}>
              soma-reviewer no puede leer /home/soma/finance/ → Permission denied ✓
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Multi-Engine ── */}
      <section style={{ padding:'120px 24px', borderTop:border }}>
        <div style={{ maxWidth:1100, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontSize:'clamp(1.8rem, 4vw, 2.5rem)', fontWeight:700, marginBottom:16 }}>
            One hub, any engine
          </h2>
          <p style={{ fontSize:16, color:muted, maxWidth:600, margin:'0 auto 48px', lineHeight:1.7 }}>
            Each agent chooses its engine. Pi for coding, ReAct for reasoning,
            OpenCode for autonomous work. Same protocol, same UI.
          </p>

          <div style={{
            display:'flex', flexWrap:'wrap', gap:16, justifyContent:'center',
          }}>
            {engines.map(e => (
              <div key={e.name} style={{
                padding:'20px 28px', borderRadius:14, border,
                background:'color-mix(in oklch, var(--zea-b2) 20%, transparent)',
                textAlign:'center', minWidth:160,
              }}>
                <div style={{ fontSize:28, marginBottom:8 }}>{e.icon}</div>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{e.name}</div>
                <div style={{ fontSize:11, color:muted }}>{e.desc}</div>
                <div style={{
                  marginTop:10, padding:'2px 10px', borderRadius:8,
                  background:e.ready ? 'color-mix(in oklch, #3fb950 10%, transparent)' : 'color-mix(in oklch, #fbbf24 10%, transparent)',
                  color:e.ready ? '#3fb950' : '#fbbf24',
                  fontSize:10, fontWeight:600, display:'inline-block',
                }}>
                  {e.ready ? 'Ready' : 'Coming soon'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding:'120px 24px', borderTop:border,
        background:'color-mix(in oklch, var(--zea-b2) 30%, transparent)',
        textAlign:'center',
      }}>
        <h2 style={{ fontSize:'clamp(1.8rem, 4vw, 2.5rem)', fontWeight:700, marginBottom:16 }}>
          Start deploying agents today
        </h2>
        <p style={{ fontSize:16, color:muted, maxWidth:500, margin:'0 auto 40px', lineHeight:1.7 }}>
          One CLI. Linux users. Kernel isolation. Any engine.
        </p>
        <button onClick={onLogin}
          className="zea-btn zea-btn--primary zea-btn--lg zea-btn--primary-shadow"
          style={{ fontSize:15, textTransform:'uppercase', fontWeight:600, letterSpacing:'0.04em', padding:'16px 48px' }}>
          Launch AgentHub →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop, padding:'48px 24px',
        color:'color-mix(in oklch, var(--zea-bc) 30%, transparent)',
        fontSize:13,
      }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <span>© 2026 ZEA Platform</span>
          <span>Soma AgentHub v0.2.0 — Multi-engine · OS sandboxes · CLI</span>
        </div>
      </footer>
    </div>
  )
}

const howItWorks = [
  {
    icon:'👤', accent:'var(--zea-p)',
    title:'Agent = Linux User',
    desc:'Each agent gets a real OS user with its own UID, home directory, and group membership. No simulated isolation — the kernel enforces access control.',
  },
  {
    icon:'🔒', accent:'#7c3aed',
    title:'chmod 700 Isolation',
    desc:'Agent A cannot read, write, or even list Agent B\'s home directory. Permissions are enforced at the syscall level — not in application code.',
  },
  {
    icon:'📂', accent:'#22d3ee',
    title:'Bind Mounts for Sharing',
    desc:'Shared directories are mounted into agent homes via Linux bind mounts. Same volume, different agents, group-based read/write permissions.',
  },
  {
    icon:'⚙️', accent:'#fbbf24',
    title:'sudo -u agent command',
    desc:'When an agent runs bash, edit, or write, the engine executes the command as that user. The kernel applies the UID\'s permissions automatically.',
  },
  {
    icon:'🧠', accent:'#3fb950',
    title:'Any Engine, Same Protocol',
    desc:'Pi, ReAct, OpenCode, Hermes, Goose — all engines implement the same AgentSession interface. Switch engines per agent without changing the client.',
  },
  {
    icon:'🏢', accent:'oklch(65% 0.15 250)',
    title:'Multi-Tenant by Design',
    desc:'Organizations, teams, and individual agents map to Linux groups. Members of org-1 share /workspace/orgs/org-1 — others cannot access it.',
  },
]

const dxFeatures = [
  { cmd:'$ soma-agent agent create', desc:'One command: user, home, config, mounts. Ready in seconds.', color:'#22d3ee' },
  { cmd:'$ soma-agent agent config set', desc:'Change engine, tools, or system prompt without restarting.', color:'#a78bfa' },
  { cmd:'$ soma-agent agent sandbox exec', desc:'Run any command as the agent. Perfect for CI/CD scripts.', color:'#fbbf24' },
  { cmd:'$ soma-agent conversation chat', desc:'Interactive chat in your terminal. Thinking, tools, streaming.', color:'#3fb950' },
  { cmd:'$ soma-agent doctor run', desc:'13-layer health check. Know what\'s broken before your users do.', color:'#ff7b72' },
  { cmd:'$ soma-agent agent destroy', desc:'Clean teardown: userdel -r + umount. Zero leftover state.', color:'#8b949e' },
]

const enterpriseFeatures = [
  { icon:'🔐', title:'Kernel Isolation', desc:'Agents are real Linux users. If the kernel says no, the agent cannot access it. No path traversal bugs possible.' },
  { icon:'👥', title:'Team Workspaces', desc:'Linux groups map to teams. Finance team agents share /workspace/teams/finance. Engineering team agents can\'t see it.' },
  { icon:'📊', title:'Shared Volumes', desc:'Bind-mount market data, internal docs, or code repos. Read-only or read-write per agent. No duplication.' },
  { icon:'🔄', title:'Ephemeral Agents', desc:'Create agents for CI runs with --ttl 1h. Auto-destroyed. Perfect for PR checks and isolated test environments.' },
  { icon:'🔑', title:'API Key per Org', desc:'Each organization gets scoped API keys. Engineering can\'t touch Finance agents. Audit trail in Thalamus.' },
  { icon:'📈', title:'Grows with You', desc:'Start with 1 agent, scale to 100. Same CLI, same API. Agents are just users — Linux scales to thousands.' },
]

const engines = [
  { icon:'🥧', name:'Pi', desc:'Coding agent with tools & skills', ready:true },
  { icon:'🔄', name:'ReAct', desc:'Reasoning + tool-calling loop', ready:false },
  { icon:'📖', name:'OpenCode', desc:'Autonomous code generation', ready:false },
  { icon:'🪽', name:'Hermes', desc:'Fast, lightweight agent', ready:false },
  { icon:'🪿', name:'Goose', desc:'Block\'s open-source agent', ready:false },
]
