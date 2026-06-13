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
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        minHeight: '90vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '64px 24px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Blur glows */}
        <div style={{
          position: 'absolute', top: '25%', left: '10%',
          width: 384, height: 384, borderRadius: '50%',
          background: 'color-mix(in oklch, var(--zea-p) 10%, transparent)',
          filter: 'blur(120px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '25%', right: '10%',
          width: 384, height: 384, borderRadius: '50%',
          background: 'color-mix(in oklch, var(--zea-s) 10%, transparent)',
          filter: 'blur(120px)', pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 1100, width: '100%', margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 64, alignItems: 'center', position: 'relative', zIndex: 10,
        }}>
          {/* Left column */}
          <div>
            <h1 style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.75rem)', fontWeight: 700,
              lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 24,
            }}>
              AI Agents for{' '}
              <span className="zea-gradient-text">
                your Infrastructure
              </span>
            </h1>
            <p style={{ fontSize: 'clamp(0.9375rem, 2vw, 1.125rem)', lineHeight: 1.65, color: muted, marginBottom: 40, maxWidth: 520 }}>
              Integrate your favorite agents — Glia, Pi, or custom — into one hub.
              Chat, files, skills, and multi-agent orchestration for your platform.
            </p>
            <button onClick={onLogin}
              className="zea-btn zea-btn--primary zea-btn--md zea-btn--primary-shadow"
              style={{ fontSize: 14, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em', padding: '12px 32px' }}>
              Launch Agent
            </button>

            {/* Steps */}
            <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
              {steps.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 16, padding: 16, borderRadius: 12,
                  background: 'color-mix(in oklch, var(--zea-b2) 50%, transparent)',
                  border,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `color-mix(in oklch, ${s.accent} 10%, transparent)`,
                    color: s.accent, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: 14,
                    border: `1px solid color-mix(in oklch, ${s.accent} 20%, transparent)`,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 'clamp(0.8125rem, 2vw, 0.9375rem)', fontWeight: 700, color: 'var(--zea-bc)', marginBottom: 8 }}>
                      {s.title}
                    </h3>
                    <p style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', color: muted }}>
                      {s.desc}
                    </p>
                    {s.code && (
                      <div style={{
                        marginTop: 12, padding: '10px 16px', borderRadius: 8,
                        background: 'var(--zea-b3)', border: '1px solid color-mix(in oklch, white 10%, transparent)',
                        fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                        color: s.accent,
                      }}>
                        {s.code}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — Terminal */}
          <div style={{
            background: 'color-mix(in oklch, #0d1117 95%, transparent)',
            borderRadius: 16, border: '1px solid color-mix(in oklch, white 10%, transparent)',
            boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.8)',
            overflow: 'hidden', backdropFilter: 'blur(12px)',
          }}>
            {/* Terminal header */}
            <div style={{
              padding: '12px 16px', background: '#161b22',
              borderBottom: '1px solid color-mix(in oklch, white 5%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'color-mix(in oklch, white 35%, transparent)', fontFamily: '"SF Mono", "Fira Code", monospace' }}>
                soma agent
              </span>
              <div style={{ width: 48 }} />
            </div>
            {/* Terminal body */}
            <div style={{
              padding: 24, fontFamily: '"SF Mono", "Fira Code", monospace',
              fontSize: 13, lineHeight: 1.8, color: 'color-mix(in oklch, white 80%, transparent)',
            }}>
              <div><span style={{ color: '#22d3ee' }}>$</span> soma connect</div>
              <div style={{ color: muted, marginTop: 8 }}>Connecting to agent...</div>
              <div style={{ color: '#3fb950', marginTop: 8 }}>✓ Agent ready</div>
              <div style={{ color: muted, marginTop: 8 }}>Skills loaded: 10</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ color: '#a855f7' }}>$</span>{' '}
                <span style={{ color: 'var(--zea-bc)' }}>create workflow backup</span>
              </div>
              <div style={{ color: muted, marginTop: 4 }}>Workflow "backup" created ✓</div>
              <div style={{ marginTop: 12 }}>
                <span style={{ color: '#a855f7' }}>$</span>{' '}
                <span style={{ color: 'var(--zea-bc)' }}>analyze portfolio</span>
              </div>
              <div style={{ color: muted, marginTop: 4 }}>Analyzing Fund II...</div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: '#3fb950' }}>✓</span> AUM: $2.4B | LPs: 42 | Active: 7
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={{ color: '#818cf8' }}>$</span>{' '}
                <span style={{
                  display: 'inline-block', width: 8, height: 16,
                  background: muted, animation: 'cranium-pulse 1s infinite',
                  verticalAlign: 'middle', borderRadius: 2,
                }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid var(--zea-b2)`,
        padding: '48px 24px',
        color: 'color-mix(in oklch, var(--zea-bc) 30%, transparent)',
        fontSize: 13,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <span>© 2026 ZEA Platform</span>
          <span>Soma v0.1.0 — AgentHub</span>
        </div>
      </footer>
    </div>
  )
}

const steps = [
  {
    title: 'Sign in with ZEA',
    desc: 'Use your ZEA Platform account to authenticate. One click, no setup.',
    accent: 'var(--zea-p)',
    code: undefined,
  },
  {
    title: 'Connect your agent',
    desc: 'Your agent loads skills from Thalamus and is ready to work instantly.',
    accent: 'oklch(70% 0.2 292)',
    code: '> Agent ready — 10 skills loaded',
  },
  {
    title: 'Start building',
    desc: 'Chat with your agent to create workflows, analyze data, or write code.',
    accent: 'oklch(65% 0.15 250)',
    code: '$ "Glia, analyze Fund II performance"',
  },
]
