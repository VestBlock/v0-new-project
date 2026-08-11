const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim()
const clientSecret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
if (!clientId || !clientSecret) throw new Error('PayPal client credentials are missing.')

const results = []
for (const mode of ['sandbox', 'live']) {
  const base = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  try {
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    })
    const body = await response.json().catch(() => ({}))
    results.push({ mode, ok: response.ok, status: response.status, error: response.ok ? null : String(body.error || 'authentication_failed') })
  } catch (error) {
    results.push({ mode, ok: false, status: 0, error: error instanceof Error ? error.name : 'request_failed' })
  }
}
console.log(JSON.stringify({ results, secretValuesExposed: false }, null, 2))
