import { createSign } from 'crypto'

export type IndexingPushOptions = {
  dryRun?: boolean
  urls?: string[]
  inspectLimit?: number
}

export type IndexingPushResult = {
  ok: boolean
  generatedAt: string
  siteUrl: string
  sitemapUrl: string
  urls: string[]
  dryRun: boolean
  google: {
    configured: boolean
    sitemapSubmitted: boolean
    inspected: Array<{
      url: string
      ok: boolean
      verdict?: string
      coverageState?: string
      error?: string
    }>
    error?: string
  }
  indexNow: {
    configured: boolean
    submitted: boolean
    status?: number
    error?: string
  }
  blockers: string[]
}

const defaultPriorityPaths = [
  '/',
  '/services',
  '/dealvault',
  '/dealvault/demo',
  '/dealvault/demo-record',
  '/smart-contracts',
  '/visibility-expansion',
  '/visibility-expansion/proof-hub',
  '/ai-assistant',
  '/funding/business-funding-strategy',
  '/es/vestblock',
  '/learn/chatgpt-visibility-service',
  '/learn/ai-receptionist-for-contractors',
  '/learn/ai-receptionist-for-real-estate-businesses',
  '/learn/smart-contract-agreement-tracking',
  '/learn/milestone-proof-software',
  '/learn/business-funding-prep-service',
  '/learn/dealvault-vs-google-drive',
  '/learn/seo-vs-chatgpt-visibility',
  '/learn/best-way-to-track-referral-payouts',
  '/learn/ai-receptionist-for-home-service-businesses',
  '/learn/ai-receptionist-for-restoration-companies',
  '/learn/ai-receptionist-for-property-managers',
  '/learn/missed-call-lead-capture-service',
  '/learn/website-chatbot-for-lead-qualification',
  '/learn/dealvault-for-referral-partners',
  '/learn/referral-payout-tracking-software',
  '/learn/agreement-tracking-software-for-small-business',
  '/learn/smart-contract-proof-records-for-business',
  '/learn/chatgpt-visibility-for-local-businesses',
  '/learn/ai-search-visibility-audit-checklist',
  '/learn/business-solution-proof-important-records',
  '/learn/service-grow-online-visibility',
  '/learn/best-tools-deal-confidence-lead-capture',
  '/learn/capture-better-leads-without-harder-customer-experience',
  '/learn/live-contract-proof-record-service',
  '/learn/enhance-online-presence-search-engine-rankings',
  '/learn/types-of-business-records-to-prove-and-store',
  '/learn/how-to-stop-missing-after-hours-leads',
  '/learn/lead-response-system-for-small-business',
  '/learn/website-visitor-qualification-software',
  '/learn/ai-receptionist-for-roofing-companies',
  '/learn/ai-receptionist-for-plumbing-companies',
  '/learn/ai-receptionist-for-med-spas',
  '/learn/why-is-my-business-not-showing-up-in-chatgpt',
  '/learn/how-to-make-a-business-easier-for-ai-to-understand',
  '/learn/answer-engine-optimization-for-service-businesses',
  '/learn/local-ai-search-visibility-for-small-business',
  '/learn/business-entity-optimization-for-ai-search',
  '/learn/llms-txt-for-small-business-websites',
  '/learn/proof-assets-for-ai-search-visibility',
  '/learn/how-to-prove-an-agreement-happened',
  '/learn/proof-of-work-records-for-contractors',
  '/learn/track-referral-fees-without-spreadsheets',
  '/learn/construction-payout-milestone-tracking',
  '/learn/private-document-proof-without-onchain-files',
  '/learn/client-approval-record-system',
  '/learn/business-funding-readiness-checklist',
  '/learn/documents-needed-before-applying-for-business-funding',
  '/learn/business-grant-readiness-checklist',
  '/learn/funding-prep-for-new-llc',
  '/learn/why-website-leads-do-not-convert',
  '/learn/website-trust-proof-checklist',
  '/learn/improve-contact-forms-for-small-business',
  '/learn/lead-capture-website-for-contractors',
  '/learn/service-business-booking-flow',
  '/learn/dinero-para-mi-negocio-sin-perder-tiempo',
  '/learn/que-necesito-para-sacar-capital-para-mi-negocio',
  '/learn/como-sacar-ein-para-mi-negocio',
  '/learn/abrir-negocio-y-prepararlo-para-financiamiento',
  '/learn/credito-para-negocio-con-ein',
  '/learn/como-empezar-credito-comercial-para-mi-negocio',
  '/learn/mi-negocio-califica-para-financiamiento',
  '/learn/prestamos-para-negocios-nuevos-en-espanol',
  '/learn/ayuda-para-conseguir-grants-para-mi-negocio',
  '/learn/cuenta-bancaria-y-papeles-para-pedir-financiamiento',
  '/resources/chatgpt-visibility-service',
  '/resources/best-way-to-track-referral-payouts',
]

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    'https://www.vestblock.io'
  ).replace(/\/+$/, '')
}

function toAbsoluteUrl(value: string, baseUrl = getBaseUrl()) {
  if (/^https?:\/\//i.test(value)) return value
  return `${baseUrl}${value.startsWith('/') ? value : `/${value}`}`
}

export function getVisibilityIndexingUrls(urls?: string[]) {
  const candidates = urls?.length ? urls : defaultPriorityPaths
  return Array.from(new Set(candidates.map((url) => toAbsoluteUrl(url))))
}

function getGoogleConfig() {
  const clientEmail = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL
  const rawPrivateKey = process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY
  const privateKey = rawPrivateKey?.replace(/\\n/g, '\n')
  const oauthClientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const oauthClientSecret =
    process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  const oauthRefreshToken = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN
  const siteUrl =
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL ||
    process.env.SEARCH_CONSOLE_SITE_URL ||
    `${getBaseUrl()}/`

  return {
    configured: Boolean((clientEmail && privateKey) || (oauthClientId && oauthClientSecret && oauthRefreshToken)),
    clientEmail,
    privateKey,
    oauthClientId,
    oauthClientSecret,
    oauthRefreshToken,
    siteUrl,
  }
}

function getIndexNowConfig() {
  const key =
    process.env.INDEXNOW_KEY ||
    process.env.BING_INDEXNOW_KEY ||
    process.env.INDEXNOW_API_KEY
  const baseUrl = getBaseUrl()
  const host = new URL(baseUrl).host
  const keyLocation =
    process.env.INDEXNOW_KEY_LOCATION ||
    (key ? `${baseUrl}/${key}.txt` : undefined)

  return {
    configured: Boolean(key),
    key,
    host,
    keyLocation,
  }
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function getGoogleAccessToken() {
  const config = getGoogleConfig()
  if (config.oauthClientId && config.oauthClientSecret && config.oauthRefreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.oauthClientId,
        client_secret: config.oauthClientSecret,
        refresh_token: config.oauthRefreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Google OAuth refresh failed: ${response.status} ${body}`)
    }

    const json = (await response.json()) as { access_token?: string }
    if (!json.access_token) {
      throw new Error('Google OAuth refresh response did not include an access token.')
    }
    return json.access_token
  }

  if (!config.clientEmail || !config.privateKey) {
    throw new Error(
      'Missing Search Console credentials. Add GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN or service-account credentials.'
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: 'https://www.googleapis.com/auth/webmasters',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  )
  const unsigned = `${header}.${claim}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = base64Url(signer.sign(config.privateKey))
  const assertion = `${unsigned}.${signature}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google OAuth token request failed: ${response.status} ${body}`)
  }

  const json = (await response.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new Error('Google OAuth token response did not include an access token.')
  }
  return json.access_token
}

async function submitGoogleSitemap(accessToken: string, siteUrl: string, sitemapUrl: string) {
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    siteUrl
  )}/sitemaps/${encodeURIComponent(sitemapUrl)}`
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google sitemap submit failed: ${response.status} ${body}`)
  }
}

async function inspectGoogleUrl(accessToken: string, siteUrl: string, inspectionUrl: string) {
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl,
      languageCode: 'en-US',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google URL inspection failed: ${response.status} ${body}`)
  }

  const json = (await response.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string
        coverageState?: string
      }
    }
  }

  return {
    verdict: json.inspectionResult?.indexStatusResult?.verdict,
    coverageState: json.inspectionResult?.indexStatusResult?.coverageState,
  }
}

async function submitIndexNow(urls: string[]) {
  const config = getIndexNowConfig()
  if (!config.key) {
    throw new Error('Missing INDEXNOW_KEY or BING_INDEXNOW_KEY.')
  }

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: config.host,
      key: config.key,
      keyLocation: config.keyLocation,
      urlList: urls,
    }),
  })

  if (!response.ok && response.status !== 202) {
    const body = await response.text()
    throw new Error(`IndexNow submit failed: ${response.status} ${body}`)
  }

  return response.status
}

export async function runVisibilityIndexingPush(options: IndexingPushOptions = {}): Promise<IndexingPushResult> {
  const urls = getVisibilityIndexingUrls(options.urls)
  const sitemapUrl = toAbsoluteUrl('/sitemap.xml')
  const googleConfig = getGoogleConfig()
  const indexNowConfig = getIndexNowConfig()
  const blockers: string[] = []
  const result: IndexingPushResult = {
    ok: false,
    generatedAt: new Date().toISOString(),
    siteUrl: googleConfig.siteUrl,
    sitemapUrl,
    urls,
    dryRun: Boolean(options.dryRun),
    google: {
      configured: googleConfig.configured,
      sitemapSubmitted: false,
      inspected: [],
    },
    indexNow: {
      configured: indexNowConfig.configured,
      submitted: false,
    },
    blockers,
  }

  if (!googleConfig.configured) {
    blockers.push('Google Search Console API credentials are missing.')
  }
  if (!indexNowConfig.configured) {
    blockers.push('IndexNow/Bing API key is missing.')
  }

  if (options.dryRun) {
    result.ok = blockers.length === 0
    return result
  }

  if (googleConfig.configured) {
    try {
      const accessToken = await getGoogleAccessToken()
      await submitGoogleSitemap(accessToken, googleConfig.siteUrl, sitemapUrl)
      result.google.sitemapSubmitted = true

      const inspectLimit = Math.max(0, options.inspectLimit ?? 5)
      for (const url of urls.slice(0, inspectLimit)) {
        try {
          const inspection = await inspectGoogleUrl(accessToken, googleConfig.siteUrl, url)
          result.google.inspected.push({ url, ok: true, ...inspection })
        } catch (error) {
          result.google.inspected.push({
            url,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown URL inspection error.',
          })
        }
      }
    } catch (error) {
      result.google.error =
        error instanceof Error ? error.message : 'Unknown Google Search Console push error.'
      blockers.push(result.google.error)
    }
  }

  if (indexNowConfig.configured) {
    try {
      const status = await submitIndexNow(urls)
      result.indexNow.submitted = true
      result.indexNow.status = status
    } catch (error) {
      result.indexNow.error =
        error instanceof Error ? error.message : 'Unknown IndexNow push error.'
      blockers.push(result.indexNow.error)
    }
  }

  result.ok = blockers.length === 0
  return result
}
