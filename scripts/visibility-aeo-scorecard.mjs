import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const files = {
  requirements: 'lib/seo/aeoVisibilityRequirements.ts',
  topics: 'lib/aeo/topics.ts',
  llmFeed: 'lib/seo/llmFeed.ts',
  sitemap: 'app/sitemap.ts',
  robots: 'app/robots.ts',
  proofAssets: 'scripts/captureVisibilityProofAssets.mjs',
  indexingPush: 'scripts/visibility-indexing-push.mjs',
  indexingRoute: 'app/api/cron/visibility-indexing-push/route.ts',
  prDocs: 'docs/VESTBLOCK_PR_PARTNER_PITCHES_2026-05-13.md',
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function extractQuotedArrayValues(source, propertyName) {
  const values = []
  const regex = new RegExp(`${propertyName}: \\[([\\s\\S]*?)\\]`, 'g')
  let match
  while ((match = regex.exec(source))) {
    const body = match[1]
    const valueRegex = /'([^']+)'|"([^"]+)"/g
    let valueMatch
    while ((valueMatch = valueRegex.exec(body))) {
      values.push(valueMatch[1] || valueMatch[2])
    }
  }
  return Array.from(new Set(values))
}

function extractExportedStringArray(source, exportName) {
  const regex = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*`,
    'm'
  )
  const match = regex.exec(source)
  if (!match) return []

  const body = match[1]
  const values = []
  const valueRegex = /'([^']+)'|"([^"]+)"/g
  let valueMatch
  while ((valueMatch = valueRegex.exec(body))) {
    values.push(valueMatch[1] || valueMatch[2])
  }
  return values
}

function includesAll(source, values) {
  const missing = values.filter((value) => !source.includes(value))
  return {
    ok: missing.length === 0,
    missing,
    found: values.length - missing.length,
    total: values.length,
  }
}

function hasFile(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function scoreRequirement(checks) {
  const passed = checks.filter((check) => check.ok).length
  return {
    passed,
    total: checks.length,
    score: checks.length ? Math.round((passed / checks.length) * 100) : 0,
  }
}

function writeArtifact(payload) {
  const outputDir = path.join(root, 'artifacts', 'visibility-aeo')
  fs.mkdirSync(outputDir, { recursive: true })
  const dateStamp = new Date().toISOString().slice(0, 10)
  const jsonPath = path.join(outputDir, `visibility-aeo-scorecard-${dateStamp}.json`)
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`)
  return jsonPath
}

function main() {
  const requirementSource = read(files.requirements)
  const topicSource = read(files.topics)
  const llmFeedSource = read(files.llmFeed)
  const sitemapSource = read(files.sitemap)
  const robotsSource = read(files.robots)
  const proofAssetSource = hasFile(files.proofAssets) ? read(files.proofAssets) : ''
  const indexingPushSource = hasFile(files.indexingPush) ? read(files.indexingPush) : ''
  const indexingRouteSource = hasFile(files.indexingRoute) ? read(files.indexingRoute) : ''
  const prSource = hasFile(files.prDocs) ? read(files.prDocs) : ''

  const requiredSlugs = extractQuotedArrayValues(requirementSource, 'requiredSlugs')
  const requiredRoutes = extractQuotedArrayValues(requirementSource, 'requiredRoutes')
  const promptTests = extractExportedStringArray(requirementSource, 'aeoVisibilityPromptTests')

  const checks = [
    {
      key: 'requirements_configured',
      label: '10 AEO visibility requirements are configured',
      ok: (requirementSource.match(/key: '/g) || []).length >= 10,
      detail: `${(requirementSource.match(/key: '/g) || []).length} requirements found.`,
    },
    {
      key: 'answer_comparison_best_for_topics',
      label: 'Required answer, proof, comparison, and best-for topics exist in AEO library',
      ...includesAll(topicSource, requiredSlugs),
    },
    {
      key: 'llms_txt_maps_requirements',
      label: 'llms.txt feed imports visibility requirements and prompt tests',
      ok: llmFeedSource.includes('aeoVisibilityRequirements') && llmFeedSource.includes('Prompt Tests VestBlock Tracks'),
      detail: 'LLM feed should expose the requirements and prompt tests to AI crawlers.',
    },
    {
      key: 'sitemap_covers_dynamic_topics',
      label: 'Sitemap includes AEO topics and service SEO pages',
      ok: sitemapSource.includes('vestblockAeoTopics') && sitemapSource.includes('serviceSeoPages'),
      detail: 'Dynamic topic/service pages are mapped into sitemap output.',
    },
    {
      key: 'robots_allows_public_discovery',
      label: 'Robots allows public discovery routes',
      ...includesAll(robotsSource, ['/llms.txt', '/services', '/learn', '/resources', '/visibility-expansion']),
    },
    {
      key: 'proof_assets_script_present',
      label: 'Proof asset capture exists for screenshots/graphics/proof hub',
      ok: hasFile(files.proofAssets) && /screenshot|proof|visibility/i.test(proofAssetSource),
      detail: files.proofAssets,
    },
    {
      key: 'offsite_pr_destinations_present',
      label: 'Off-site/PR destination planning exists',
      ok: /Destinations to research|podcast|newsletter|directory|BiggerPockets|chamber/i.test(prSource),
      detail: files.prDocs,
    },
    {
      key: 'prompt_tests_configured',
      label: 'Prompt tests are configured for ChatGPT/AI visibility tracking',
      ok:
        promptTests.length >= 20 &&
        promptTests.some((prompt) => /vestblock/i.test(prompt)) &&
        promptTests.some((prompt) => /^(como|que|qué|donde|dónde)\b/i.test(prompt.trim())),
      detail: `Prompt tests found: ${promptTests.length}.`,
    },
    {
      key: 'indexing_checklist_present',
      label: 'Indexing push automation is present for Google Search Console and IndexNow',
      ok:
        /Indexing push checklist/.test(requirementSource) &&
        requiredRoutes.includes('/sitemap.xml') &&
        requiredRoutes.includes('/api/cron/visibility-indexing-push') &&
        /GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL/.test(indexingPushSource) &&
        /INDEXNOW_KEY|BING_INDEXNOW_KEY/.test(indexingPushSource) &&
        /runVisibilityIndexingPush/.test(indexingRouteSource),
      detail: 'Search Console sitemap submit, URL inspection, and IndexNow/Bing push are wired behind env guards.',
    },
    {
      key: 'trust_safe_claims_present',
      label: 'Trust-safe claim guardrails are part of automation requirements',
      ok: /Trust-safe claim guardrails/.test(requirementSource) && /does not guarantee placement in ChatGPT/.test(llmFeedSource),
      detail: 'Visibility automation should avoid fake ranking guarantees.',
    },
  ]

  const summary = scoreRequirement(checks)
  const blockers = checks.filter((check) => !check.ok).map((check) => check.key)
  const payload = {
    ok: blockers.length === 0,
    generatedAt: new Date().toISOString(),
    summary,
    blockers,
    requiredSlugs,
    requiredRoutes,
    checks,
    nextActions:
      blockers.length === 0
        ? [
            'Run the daily content publisher so the new answer/comparison/best-for topics can enter the public content flow.',
            'Capture fresh proof screenshots and submit changed URLs through Search Console/Bing where available.',
            'Track the prompt tests weekly and create pages for any competitor/entity gaps.',
          ]
        : ['Fix failing visibility checks before claiming the SEO/AEO automation covers the full strategy.'],
  }

  const artifactPath = writeArtifact(payload)
  console.log(JSON.stringify({ ...payload, artifactPath }, null, 2))
}

main()
