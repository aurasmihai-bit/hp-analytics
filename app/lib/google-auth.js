import crypto from 'crypto'

function parseServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  const serviceAccount = JSON.parse(raw)
  if (serviceAccount.private_key?.includes('\\n')) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  }
  return serviceAccount
}

function base64Url(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  return Buffer.from(raw).toString('base64url')
}

export async function getGoogleAccessToken(scope) {
  const serviceAccount = parseServiceAccount()
  if (!serviceAccount) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: serviceAccount.private_key_id }
  const payload = {
    iss: serviceAccount.client_email,
    scope,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
  }

  const unsignedJwt = `${base64Url(header)}.${base64Url(payload)}`
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(unsignedJwt), serviceAccount.private_key)
    .toString('base64url')
  const assertion = `${unsignedJwt}.${signature}`

  const res = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const text = await res.text()
  const body = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`Google token ${res.status}: ${body?.error_description || body?.error || text}`)
  return body.access_token
}
