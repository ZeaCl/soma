const CLIENT_ID = 'soma_service'

function getBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://soma.zea.localhost'
  const host = window.location.hostname
  // Production: soma.zea.cl → auth.zea.cl
  if (host.endsWith('.zea.cl')) {
    return `https://${host}`
  }
  // Local dev: soma.zea.localhost → auth.zea.localhost
  return `http://${host}`
}

function getAuthUrl(): string {
  if (typeof window === 'undefined') return 'http://auth.zea.localhost'
  const host = window.location.hostname
  if (host.endsWith('.zea.cl')) return 'https://auth.zea.cl'
  if (host.endsWith('.zea.localhost')) return 'http://auth.zea.localhost'
  return 'http://auth.zea.localhost'
}

function getRedirectUri(): string {
  return `${getBaseUrl()}/callback`
}

function base64URLEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain))
}

export function generatePKCE() {
  const verifier = base64URLEncode(crypto.getRandomValues(new Uint8Array(32)))
  return { verifier, challenge: sha256(verifier).then(base64URLEncode) }
}

export function getAuthorizationUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'openid profile email',
    state: crypto.randomUUID(),
  })
  return `${getAuthUrl()}/oauth/authorize?${params}`
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const res = await fetch(`${getAuthUrl()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: getRedirectUri(),
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}
