import { useEffect } from 'react'
import { generatePKCE, getAuthorizationUrl } from './oauth'

export default function Login() {
  useEffect(() => {
    const { verifier, challenge } = generatePKCE()
    sessionStorage.setItem('soma_pkce_verifier', verifier)
    challenge.then((codeChallenge: string) => {
      window.location.href = getAuthorizationUrl(codeChallenge)
    })
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--zea-b3)', color: 'var(--zea-bc)',
      fontFamily: 'var(--zea-sans)', fontSize: 16,
    }}>
      Redirecting to ZEA login...
    </div>
  )
}
