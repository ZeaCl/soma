interface LandingProps {
  onLogin: () => void
}

export default function Landing({ onLogin }: LandingProps) {
  return (
    <div className="zea-page">
      {/* Nav */}
      <nav className="zea-nav">
        <div className="zea-nav__inner">
          <a href="/" className="zea-nav__logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/icono-zea.svg" alt="ZEA" style={{ height: 24 }} />
            <span style={{ fontWeight: 700, fontSize: 18 }}>Soma</span>
          </a>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="https://docs.zea.dev" className="zea-link" target="_blank">Docs</a>
            <button onClick={onLogin} className="zea-btn zea-btn--primary zea-btn--sm">Sign In</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="zea-hero" style={{ textAlign: 'center', padding: '100px 24px 80px' }}>
        <span className="zea-badge zea-badge--purple" style={{ marginBottom: 20, display: 'inline-block' }}>AgentHub</span>
        <h1 className="zea-gradient-text" style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', maxWidth: 700, margin: '0 auto 20px' }}>
          AI Agents for the ZEA Platform
        </h1>
        <p className="zea-body-lg" style={{ maxWidth: 560, margin: '0 auto 36px', color: 'var(--zea-bc-muted)' }}>
          Chat, files, skills, and multi-agent conversations — all in one place.
          Powered by the Glia Engine and Pi SDK.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onLogin} className="zea-btn zea-btn--primary zea-btn--md zea-btn--primary-shadow">
            Launch Agent →
          </button>
          <a href="https://docs.zea.dev" className="zea-btn zea-btn--outline zea-btn--md" target="_blank">
            Read Docs
          </a>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px', maxWidth: 1024, margin: '0 auto' }}>
        <div className="zea-section-header" style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 className="zea-heading-lg">Everything you need</h2>
          <p className="zea-body-md" style={{ color: 'var(--zea-bc-muted)' }}>Built for teams that ship with AI.</p>
        </div>
        <div className="zea-grid-3">
          {features.map(f => (
            <div key={f.title} className="zea-card--feature">
              <div className="zea-card__icon">{f.icon}</div>
              <h3 className="zea-heading-sm">{f.title}</h3>
              <p className="zea-body-sm" style={{ color: 'var(--zea-bc-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div className="zea-card--cta">
          <h2 className="zea-heading-md" style={{ marginBottom: 12 }}>Ready to build with agents?</h2>
          <p className="zea-body-md" style={{ color: 'var(--zea-bc-muted)', marginBottom: 28 }}>
            Connect your first agent in under 5 minutes.
          </p>
          <button onClick={onLogin} className="zea-btn zea-btn--primary zea-btn--lg zea-btn--primary-shadow">
            Get Started →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="zea-footer">
        <div className="zea-footer__inner">
          <span>© 2026 ZEA Platform</span>
          <span style={{ color: 'var(--zea-bc-muted)' }}>Soma v0.1.0</span>
        </div>
      </footer>
    </div>
  )
}

const features = [
  { icon: '💬', title: 'Agent Chat', desc: 'Real-time streaming conversations with AI agents via WebSocket.' },
  { icon: '📁', title: 'File Workspace', desc: 'Upload, organize, and share files across conversations.' },
  { icon: '🧠', title: 'Custom Skills', desc: 'Extend agents with domain-specific skills and tools.' },
  { icon: '🔄', title: 'Multi-Agent', desc: 'Orchestrate multiple agents in a single conversation.' },
  { icon: '🔐', title: 'ZEA Auth', desc: 'Integrated with Thalamus for RBAC and multi-tenancy.' },
  { icon: '⚡', title: 'Pi SDK', desc: 'Powered by the Pi coding agent harness for full-stack development.' },
]
