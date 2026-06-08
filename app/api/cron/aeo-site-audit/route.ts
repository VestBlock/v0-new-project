export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily AEO Site Audit Cron — /api/cron/aeo-site-audit
 *
 * Runs once per day via Vercel Cron (see vercel.json schedule).
 * Audits VestBlock for Answer Engine Optimization health:
 *   - Checks that all key public pages are reachable (200)
 *   - Verifies robots.txt includes critical pages
 *   - Checks sitemap for core routes
 *   - Audits structured data presence on key pages
 *   - Surfaces missing pages, low-priority routes, and schema gaps
 *   - Produces a short, actionable AEO report stored in Supabase
 *
 * Reports are stored in `aeo_audit_reports` table if SUPABASE credentials exist.
 * If not, the report is returned in the response body only.
 *
 * How it works:
 *   1. Fetch each key page and check HTTP status
 *   2. Parse robots.txt to verify AEO crawlers are allowed
 *   3. Fetch sitemap.xml and count/verify key routes
 *   4. Run a basic metadata/schema-presence check via HEAD + response headers
 *   5. Score each area (0-100) and produce a summary
 *
 * Configuration:
 *   - NEXT_PUBLIC_SITE_URL: base URL for the site (default: https://www.vestblock.io)
 *   - CRON_SECRET: Bearer token required to authorize cron calls
 *   - NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY: optional for persistence
 */

import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/system/cronAuth'

/* ─── Route definitions ──────────────────────────────────────────────── */

const CORE_ROUTES = [
  { path: '/', label: 'Homepage', priority: 'critical' as const },
  { path: '/sell', label: 'Seller intake', priority: 'critical' as const },
  { path: '/buyers', label: 'Buyer buy box', priority: 'critical' as const },
  { path: '/lenders', label: 'Lender network', priority: 'critical' as const },
  { path: '/dealvault', label: 'DealVault landing', priority: 'critical' as const },
  { path: '/dealvault/demo', label: 'DealVault demo request', priority: 'high' as const },
  { path: '/real-estate-funding', label: 'Real estate funding', priority: 'high' as const },
  { path: '/pricing', label: 'Pricing page', priority: 'high' as const },
  { path: '/services', label: 'Services directory', priority: 'high' as const },
  { path: '/smart-contracts', label: 'Smart contracts proof', priority: 'medium' as const },
  { path: '/learn', label: 'Learn/AEO content hub', priority: 'medium' as const },
]

const REQUIRED_ROBOTS_PATHS = [
  '/',
  '/sell',
  '/buyers',
  '/lenders',
  '/dealvault',
  '/dealvault/demo',
  '/real-estate-funding',
  '/pricing',
  '/services',
  '/dealflow-growth-system',
  '/proof',
]

const REQUIRED_SITEMAP_PATHS = [
  '/',
  '/sell',
  '/buyers',
  '/lenders',
  '/dealvault',
  '/pricing',
  '/services',
  '/real-estate-funding',
  '/dealflow-growth-system',
  '/proof',
]

const SCHEMA_PAGES = [
  { path: '/', requiredSchemas: ['FAQPage', 'Organization', 'WebSite', 'Service'] },
  { path: '/sell', requiredSchemas: ['FAQPage', 'Service', 'BreadcrumbList'] },
  { path: '/buyers', requiredSchemas: ['FAQPage', 'Service', 'BreadcrumbList'] },
  { path: '/lenders', requiredSchemas: ['FAQPage', 'Service', 'BreadcrumbList'] },
  { path: '/real-estate-funding', requiredSchemas: ['FAQPage', 'Service', 'BreadcrumbList'] },
  { path: '/pricing', requiredSchemas: ['FAQPage', 'BreadcrumbList'] },
  { path: '/dealvault', requiredSchemas: ['FAQPage', 'Service', 'BreadcrumbList'] },
  { path: '/services', requiredSchemas: ['ItemList'] },
]

/* ─── Types ────────────────────────────────────────────────────────────── */

type Priority = 'critical' | 'high' | 'medium'

interface RouteAuditResult {
  path: string
  label: string
  priority: Priority
  status: number | null
  ok: boolean
  responseTimeMs: number
  issue?: string
}

interface RobotsAuditResult {
  score: number
  allowedPaths: string[]
  missingPaths: string[]
  hasAeoUserAgents: boolean
  hasSitemapDirective: boolean
}

interface SitemapAuditResult {
  score: number
  totalUrls: number
  foundPaths: string[]
  missingPaths: string[]
  reachable: boolean
}

interface SchemaAuditResult {
  path: string
  requiredSchemas: string[]
  foundSchemas: string[]
  missingSchemas: string[]
  score: number
}

interface AeoAuditReport {
  runAt: string
  siteUrl: string
  overallScore: number
  routeResults: RouteAuditResult[]
  robotsAudit: RobotsAuditResult
  sitemapAudit: SitemapAuditResult
  schemaAudits: SchemaAuditResult[]
  criticalIssues: string[]
  recommendations: string[]
  scoreSummary: {
    routes: number
    robots: number
    sitemap: number
    schema: number
  }
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io'
  ).replace(/\/$/, '')
}

async function checkRoute(siteUrl: string, route: typeof CORE_ROUTES[number]): Promise<RouteAuditResult> {
  const url = `${siteUrl}${route.path}`
  const start = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'VestBlock-AEO-Audit/1.0' },
    })
    clearTimeout(timeout)

    const responseTimeMs = Date.now() - start
    const ok = response.status >= 200 && response.status < 400

    return {
      path: route.path,
      label: route.label,
      priority: route.priority,
      status: response.status,
      ok,
      responseTimeMs,
      issue: ok ? undefined : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      path: route.path,
      label: route.label,
      priority: route.priority,
      status: null,
      ok: false,
      responseTimeMs: Date.now() - start,
      issue: error instanceof Error ? error.message : 'Request failed',
    }
  }
}

async function auditRobots(siteUrl: string): Promise<RobotsAuditResult> {
  try {
    const response = await fetch(`${siteUrl}/robots.txt`, {
      headers: { 'User-Agent': 'VestBlock-AEO-Audit/1.0' },
    })
    const text = await response.text()

    const allowedPaths: string[] = []
    const disallowedPaths: string[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('Allow:')) {
        const path = trimmed.replace('Allow:', '').trim()
        if (path) allowedPaths.push(path)
      }
      if (trimmed.startsWith('Disallow:')) {
        const path = trimmed.replace('Disallow:', '').trim()
        if (path) disallowedPaths.push(path)
      }
    }

    const hasAeoUserAgents =
      text.includes('GPTBot') ||
      text.includes('ClaudeBot') ||
      text.includes('PerplexityBot')

    const hasSitemapDirective = text.includes('Sitemap:')

    const missingPaths = REQUIRED_ROBOTS_PATHS.filter((required) => {
      const explicitlyAllowed = allowedPaths.includes(required)
      const blocked = disallowedPaths.some((disallowed) => {
        const normalized = disallowed.replace(/\/$/, '')
        return required === normalized || required.startsWith(`${normalized}/`)
      })
      return !explicitlyAllowed || blocked
    })

    const score = Math.round(
      ((REQUIRED_ROBOTS_PATHS.length - missingPaths.length) / REQUIRED_ROBOTS_PATHS.length) * 70 +
        (hasAeoUserAgents ? 20 : 0) +
        (hasSitemapDirective ? 10 : 0)
    )

    return { score, allowedPaths, missingPaths, hasAeoUserAgents, hasSitemapDirective }
  } catch {
    return {
      score: 0,
      allowedPaths: [],
      missingPaths: REQUIRED_ROBOTS_PATHS,
      hasAeoUserAgents: false,
      hasSitemapDirective: false,
    }
  }
}

async function auditSitemap(siteUrl: string): Promise<SitemapAuditResult> {
  try {
    const response = await fetch(`${siteUrl}/sitemap.xml`, {
      headers: { 'User-Agent': 'VestBlock-AEO-Audit/1.0' },
    })

    if (!response.ok) {
      return { score: 0, totalUrls: 0, foundPaths: [], missingPaths: REQUIRED_SITEMAP_PATHS, reachable: false }
    }

    const xml = await response.text()
    const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g) || []
    const urls = urlMatches.map((m) => m.replace(/<\/?loc>/g, '').replace(siteUrl, ''))
    const totalUrls = urls.length

    const foundPaths = REQUIRED_SITEMAP_PATHS.filter((path) =>
      urls.some((u) => u === path || u === `${path}/`)
    )
    const missingPaths = REQUIRED_SITEMAP_PATHS.filter((path) => !foundPaths.includes(path))

    const score = Math.round(
      ((foundPaths.length / REQUIRED_SITEMAP_PATHS.length) * 80) +
        (totalUrls >= 20 ? 20 : (totalUrls / 20) * 20)
    )

    return { score, totalUrls, foundPaths, missingPaths, reachable: true }
  } catch {
    return { score: 0, totalUrls: 0, foundPaths: [], missingPaths: REQUIRED_SITEMAP_PATHS, reachable: false }
  }
}

async function auditSchemaPage(siteUrl: string, page: typeof SCHEMA_PAGES[number]): Promise<SchemaAuditResult> {
  try {
    const response = await fetch(`${siteUrl}${page.path}`, {
      headers: { 'User-Agent': 'VestBlock-AEO-Audit/1.0' },
    })
    const html = await response.text()

    // Extract LD+JSON blocks and look for schema types
    const foundSchemas: string[] = []
    const ldJsonMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []

    for (const block of ldJsonMatches) {
      const content = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim()
      try {
        const parsed = JSON.parse(content)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          const type = item['@type']
          if (type && !foundSchemas.includes(type)) foundSchemas.push(type)
        }
      } catch {
        // ignore parse errors
      }
    }

    const missingSchemas = page.requiredSchemas.filter((s) => !foundSchemas.includes(s))
    const score = Math.round(((page.requiredSchemas.length - missingSchemas.length) / page.requiredSchemas.length) * 100)

    return { path: page.path, requiredSchemas: page.requiredSchemas, foundSchemas, missingSchemas, score }
  } catch {
    return {
      path: page.path,
      requiredSchemas: page.requiredSchemas,
      foundSchemas: [],
      missingSchemas: page.requiredSchemas,
      score: 0,
    }
  }
}

/* ─── Main audit orchestrator ────────────────────────────────────────── */

async function runAeoAudit(siteUrl: string): Promise<AeoAuditReport> {
  const runAt = new Date().toISOString()

  // Run all checks in parallel where possible
  const [routeResults, robotsAudit, sitemapAudit] = await Promise.all([
    Promise.all(CORE_ROUTES.map((r) => checkRoute(siteUrl, r))),
    auditRobots(siteUrl),
    auditSitemap(siteUrl),
  ])

  // Schema audits need to fetch full pages — run concurrently
  const schemaAudits = await Promise.all(SCHEMA_PAGES.map((p) => auditSchemaPage(siteUrl, p)))

  // Compute route score
  const criticalRoutes = routeResults.filter((r) => r.priority === 'critical')
  const criticalOk = criticalRoutes.filter((r) => r.ok).length
  const highRoutes = routeResults.filter((r) => r.priority === 'high')
  const highOk = highRoutes.filter((r) => r.ok).length
  const routeScore = Math.round(
    (criticalOk / Math.max(criticalRoutes.length, 1)) * 70 +
      (highOk / Math.max(highRoutes.length, 1)) * 30
  )

  // Compute average schema score
  const avgSchemaScore = schemaAudits.length
    ? Math.round(schemaAudits.reduce((sum, s) => sum + s.score, 0) / schemaAudits.length)
    : 100

  const scoreSummary = {
    routes: routeScore,
    robots: robotsAudit.score,
    sitemap: sitemapAudit.score,
    schema: avgSchemaScore,
  }

  const overallScore = Math.round(
    (scoreSummary.routes * 0.35) +
      (scoreSummary.robots * 0.2) +
      (scoreSummary.sitemap * 0.25) +
      (scoreSummary.schema * 0.2)
  )

  // Build critical issues list
  const criticalIssues: string[] = []

  for (const route of routeResults) {
    if (!route.ok && route.priority === 'critical') {
      criticalIssues.push(`CRITICAL: ${route.label} (${route.path}) returned ${route.status ?? 'no response'}`)
    }
  }

  if (robotsAudit.missingPaths.length > 0) {
    criticalIssues.push(
      `robots.txt: Missing allow entries for ${robotsAudit.missingPaths.join(', ')}`
    )
  }

  if (!robotsAudit.hasAeoUserAgents) {
    criticalIssues.push('robots.txt: Missing explicit AEO user-agent entries (GPTBot, ClaudeBot, PerplexityBot)')
  }

  if (sitemapAudit.missingPaths.length > 0) {
    criticalIssues.push(
      `sitemap.xml: Missing entries for ${sitemapAudit.missingPaths.join(', ')}`
    )
  }

  for (const schema of schemaAudits) {
    if (schema.missingSchemas.length > 0) {
      criticalIssues.push(
        `${schema.path}: Missing schema types: ${schema.missingSchemas.join(', ')}`
      )
    }
  }

  // Build recommendations
  const recommendations: string[] = []

  if (overallScore >= 90) {
    recommendations.push('AEO health is strong. Continue publishing answer-ready content and FAQ updates.')
  } else if (overallScore >= 70) {
    recommendations.push('AEO health is good. Address schema gaps and any broken routes.')
  } else {
    recommendations.push('AEO health needs attention. Prioritize route availability and robots/sitemap completeness.')
  }

  const slowRoutes = routeResults.filter((r) => r.ok && r.responseTimeMs > 3000)
  if (slowRoutes.length > 0) {
    recommendations.push(
      `Slow page load times detected for: ${slowRoutes.map((r) => r.path).join(', ')} — may affect crawl budget.`
    )
  }

  if (sitemapAudit.totalUrls < 30) {
    recommendations.push('Sitemap has fewer than 30 URLs. Consider adding more AEO topic pages and service guides.')
  }

  if (avgSchemaScore < 80) {
    recommendations.push('Improve structured data coverage. Add FAQ, Service, and BreadcrumbList schema to key pages.')
  }

  return {
    runAt,
    siteUrl,
    overallScore,
    routeResults,
    robotsAudit,
    sitemapAudit,
    schemaAudits,
    criticalIssues,
    recommendations,
    scoreSummary,
  }
}

/* ─── Persist report to Supabase (best-effort) ────────────────────────── */

async function persistReport(report: AeoAuditReport): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceKey) return

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await supabase.from('aeo_audit_reports').insert({
      run_at: report.runAt,
      site_url: report.siteUrl,
      overall_score: report.overallScore,
      score_summary: report.scoreSummary,
      critical_issues: report.criticalIssues,
      recommendations: report.recommendations,
      route_results: report.routeResults,
      robots_audit: report.robotsAudit,
      sitemap_audit: report.sitemapAudit,
      schema_audits: report.schemaAudits,
    })
  } catch (err) {
    // Non-fatal — report is returned in response body regardless
    console.warn('[aeo-site-audit] Supabase persist skipped:', err instanceof Error ? err.message : String(err))
  }
}

/* ─── Route handler ────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')

    const siteUrl = getSiteUrl()
    const report = await runAeoAudit(siteUrl)

    if (!dryRun) {
      await persistReport(report)
    }

    return NextResponse.json({
      success: true,
      dryRun,
      overallScore: report.overallScore,
      scoreSummary: report.scoreSummary,
      criticalIssues: report.criticalIssues,
      recommendations: report.recommendations,
      routeResults: report.routeResults.map((r) => ({
        path: r.path,
        label: r.label,
        priority: r.priority,
        ok: r.ok,
        status: r.status,
        responseTimeMs: r.responseTimeMs,
        issue: r.issue,
      })),
      robotsAudit: {
        score: report.robotsAudit.score,
        hasAeoUserAgents: report.robotsAudit.hasAeoUserAgents,
        hasSitemapDirective: report.robotsAudit.hasSitemapDirective,
        missingPaths: report.robotsAudit.missingPaths,
      },
      sitemapAudit: {
        score: report.sitemapAudit.score,
        totalUrls: report.sitemapAudit.totalUrls,
        reachable: report.sitemapAudit.reachable,
        missingPaths: report.sitemapAudit.missingPaths,
      },
      schemaAudits: report.schemaAudits,
      runAt: report.runAt,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AEO site audit failed.' },
      { status: 500 }
    )
  }
}
