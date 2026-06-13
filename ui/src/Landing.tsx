interface LandingProps { onLogin: () => void }

export default function Landing({ onLogin }: LandingProps) {
  return (
    <div style={{ background: 'var(--zea-b3)' }}>
      {/* Nav */}
      <header style={{
        background: 'var(--zea-b3)', borderBottom: '1px solid var(--zea-b3)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <img src="/icono-zea.svg" alt="ZEA" style={{ height: 22 }} />
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--zea-bc)' }}>Soma</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="https://docs.zea.dev" target="_blank"
              style={{ fontSize: 13, color: 'color-mix(in oklch, var(--zea-bc) 60%, transparent)', fontWeight: 500 }}>
              Docs
            </a>
            <button onClick={onLogin} className="zea-btn zea-btn--primary zea-btn--sm">
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '100px 24px 80px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* Blur glows */}
        <div style={{
          position: 'absolute', top: '20%', left: '5%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'color-mix(in oklch, var(--zea-p) 15%, transparent)',
          filter: 'blur(100px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '5%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'color-mix(in oklch, var(--zea-a) 12%, transparent)',
          filter: 'blur(100px)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 9999,
            background: 'color-mix(in oklch, var(--zea-a) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--zea-a) 20%, transparent)',
            color: 'oklch(70% 0.2 292)', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24,
          }}>
            AgentHub
          </span>

          <h1 className="zea-gradient-text" style={{
            fontSize: 'clamp(2.5rem, 6vw, 3.75rem)', fontWeight: 700,
            lineHeight: 1.1, letterSpacing: '-0.02em', maxWidth: 750,
            margin: '0 auto 24px',
          }}>
            AI Agents for the ZEA Platform
          </h1>

          <p style={{
            fontSize: 18, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 40px',
            color: 'color-mix(in oklch, var(--zea-bc) 50%, transparent)',
          }}>
            Chat, files, skills, and multi-agent conversations — all in one place.
            Powered by the Glia Engine and Pi SDK.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onLogin}
              className="zea-btn zea-btn--primary zea-btn--lg zea-btn--primary-shadow"
              style={{ fontSize: 15 }}>
              Launch Agent →
            </button>
            <a href="https://docs.zea.dev" target="_blank" className="zea-btn zea-btn--ghost zea-btn--lg"
              style={{ border: '1px solid color-mix(in oklch, white 10%, transparent)' }}>
              Read Docs
            </a>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section style={{
        maxWidth: 1024, margin: '0 auto', padding: '40px 24px 80px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 className="zea-heading-lg" style={{ marginBottom: 8 }}>Everything you need</h2>
          <p className="zea-body-md" style={{ color: 'color-mix(in oklch, var(--zea-bc) 40%, transparent)' }}>
            Built for teams that ship with AI.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16,
        }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: 'var(--zea-b3)', borderRadius: 16, padding: 28,
              border: '1px solid color-mix(in oklch, white 5%, transparent)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--zea-b2)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 22, marginBottom: 20,
              }}>
                {f.icon}
              </div>
              <h3 className="zea-heading-sm" style={{ marginBottom: 8 }}>{f.title}</h3>
              <p className="zea-body-sm" style={{ color: 'color-mix(in oklch, var(--zea-bc) 40%, transparent)', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        maxWidth: 1024, margin: '0 auto', padding: '0 24px 80px',
      }}>
        <div style={{
          background: 'var(--zea-b1)', borderRadius: 24,
          border: '1px solid color-mix(in oklch, var(--zea-p) 15%, transparent)',
          padding: '56px 32px', textAlign: 'center',
          backdropFilter: 'blur(24px)',
        }}>
          <h2 className="zea-heading-md" style={{ marginBottom: 12 }}>
            Ready to build with agents?
          </h2>
          <p style={{
            fontSize: 16, lineHeight: 1.6, marginBottom: 32,
            color: 'color-mix(in oklch, var(--zea-bc) 40%, transparent)',
          }}>
            Connect your first agent in under 5 minutes.
          </p>
          <button onClick={onLogin}
            className="zea-btn zea-btn--primary zea-btn--lg zea-btn--primary-shadow">
            Get Started →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--zea-b2)',
        padding: '48px 24px',
        color: 'color-mix(in oklch, var(--zea-bc) 30%, transparent)',
        fontSize: 13,
      }}>
        <div style={{ maxWidth: 1024, margin: '0 auto', display: 'flex', justifyContent: 'space-between' }}>
          <span>© 2026 ZEA Platform</span>
          <span>Soma v0.1.0</span>
        </div>
      </footer>
    </div>
  )
}

const features = [
  { icon: '💬', title: 'Agent Chat', desc: 'Real-time streaming conversations with AI agents via WebSocket. Built on the Pi coding agent harness.' },
  { icon: '📁', title: 'File Workspace', desc: 'Upload, organize, and share files across conversations with full version history.' },
  { icon: '🧠', title: 'Custom Skills', desc: 'Extend agents with domain-specific skills loaded from Thalamus agent config.' },
  { icon: '🔄', title: 'Multi-Agent', desc: 'Orchestrate multiple agents in a single conversation with role-based routing.' },
  { icon: '🔐', title: 'ZEA Auth', desc: 'Integrated with Thalamus for OAuth2, RBAC, and multi-tenancy out of the box.' },
  { icon: '⚡', title: 'Pi SDK', desc: 'Powered by the Pi coding agent harness for full-stack development workflows.' },
]
