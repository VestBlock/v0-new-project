const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
if (!apiKey) throw new Error('OPENAI_API_KEY is missing.')

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    max_tokens: 1,
    temperature: 0,
  }),
  redirect: 'error',
  signal: AbortSignal.timeout(30_000),
})
const body = await response.json().catch(() => ({}))
console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  errorCode: response.ok ? null : body?.error?.code || body?.error?.type || 'request_failed',
  outputExposed: false,
  secretValueExposed: false,
}, null, 2))
if (!response.ok) process.exitCode = 2
