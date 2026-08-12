import fs from 'node:fs'
import path from 'node:path'

const siteUrl = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://vestblock.io').replace(/\/$/, '')
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const requestedLimit = Number.parseInt(limitArg?.split('=')[1] || '400', 10)
const maxUrls = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 1000) : 400
const concurrency = 8

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}

function tagValue(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null
}

function attributeValue(tag, name) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]?.trim() || null
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  const target = tags.find((tag) => attributeValue(tag, 'name')?.toLowerCase() === name.toLowerCase())
  return target ? attributeValue(target, 'content') : null
}

function canonicalHref(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || []
  const target = tags.find((tag) => attributeValue(tag, 'rel')?.toLowerCase().split(/\s+/).includes('canonical'))
  return target ? attributeValue(target, 'href') : null
}

function visibleWordCount(html) {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.split(' ').length : 0
}

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'VestBlock-Live-SEO-Audit/1.0' },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function auditUrl(url) {
  const startedAt = Date.now()
  try {
    const response = await fetchWithTimeout(url)
    const contentType = response.headers.get('content-type') || ''
    const isHtml = contentType.includes('text/html')
    const html = isHtml ? await response.text() : ''
    const title = tagValue(html, 'title')
    const description = metaContent(html, 'description')
    const canonical = canonicalHref(html)
    const robots = metaContent(html, 'robots') || ''
    return {
      url,
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
      responseTimeMs: Date.now() - startedAt,
      title,
      description,
      canonical,
      noindex: /\bnoindex\b/i.test(robots),
      jsonLdCount: (html.match(/application\/ld\+json/gi) || []).length,
      wordCount: visibleWordCount(html),
      finalUrl: response.url,
      contentType,
      isHtml,
      error: null,
    }
  } catch (error) {
    return {
      url,
      status: null,
      ok: false,
      responseTimeMs: Date.now() - startedAt,
      title: null,
      description: null,
      canonical: null,
      noindex: false,
      jsonLdCount: 0,
      wordCount: 0,
      finalUrl: null,
      contentType: null,
      isHtml: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function mapConcurrent(items, worker) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

async function main() {
  const sitemapUrl = `${siteUrl}/sitemap.xml`
  const sitemapResponse = await fetchWithTimeout(sitemapUrl)
  if (!sitemapResponse.ok) throw new Error(`Sitemap returned HTTP ${sitemapResponse.status}`)
  const sitemapXml = await sitemapResponse.text()
  const discoveredUrls = Array.from(sitemapXml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi))
    .map((match) => decodeXml(match[1].trim()))
    .filter((url) => url.startsWith(siteUrl) || url.startsWith(`${siteUrl.replace('://', '://www.')}`))
  const urls = [...new Set(discoveredUrls)].slice(0, maxUrls)
  const pages = await mapConcurrent(urls, auditUrl)
  const broken = pages.filter((page) => !page.ok)
  const htmlPages = pages.filter((page) => page.ok && page.isHtml)
  const missingTitle = htmlPages.filter((page) => !page.title)
  const missingDescription = htmlPages.filter((page) => !page.description)
  const missingCanonical = htmlPages.filter((page) => !page.canonical)
  const unintendedNoindex = htmlPages.filter((page) => page.noindex)
  const thinPages = htmlPages.filter((page) => page.wordCount < 120)
  const payload = {
    ok:
      urls.length > 0 &&
      broken.length === 0 &&
      missingTitle.length === 0 &&
      missingDescription.length === 0 &&
      missingCanonical.length === 0 &&
      unintendedNoindex.length === 0,
    generatedAt: new Date().toISOString(),
    siteUrl,
    sitemapUrl,
    discoveredUrlCount: discoveredUrls.length,
    auditedUrlCount: pages.length,
    summary: {
      healthy: pages.filter((page) => page.ok).length,
      broken: broken.length,
      missingTitle: missingTitle.length,
      missingDescription: missingDescription.length,
      missingCanonical: missingCanonical.length,
      unintendedNoindex: unintendedNoindex.length,
      noStructuredData: htmlPages.filter((page) => page.jsonLdCount === 0).length,
      thinPages: thinPages.length,
    },
    issues: {
      broken,
      missingTitle,
      missingDescription,
      missingCanonical,
      unintendedNoindex,
      thinPages,
    },
    pages,
  }

  const outputDir = path.join(process.cwd(), 'reports')
  fs.mkdirSync(outputDir, { recursive: true })
  const datedPath = path.join(outputDir, `live-seo-audit-${payload.generatedAt.slice(0, 10)}.json`)
  const latestPath = path.join(outputDir, 'live-seo-audit-latest.json')
  fs.writeFileSync(datedPath, `${JSON.stringify(payload, null, 2)}\n`)
  fs.writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(JSON.stringify({ ...payload, pages: undefined, issues: undefined, datedPath, latestPath }, null, 2))
  if (!payload.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
