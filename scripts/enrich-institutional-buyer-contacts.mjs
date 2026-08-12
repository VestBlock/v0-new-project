#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)

function getArg(name, fallback = '') {
  const withEquals = args.find((arg) => arg.startsWith(`${name}=`))
  if (withEquals) return withEquals.slice(name.length + 1)
  const index = args.indexOf(name)
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1]
  return fallback
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') quoted = false
      else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [headers = [], ...body] = rows
  return body
    .filter((values) => values.some((value) => String(value || '').trim()))
    .map((values) => {
      const normalizedValues = values.slice(0, headers.length)
      while (normalizedValues.length < headers.length) normalizedValues.push('')
      return Object.fromEntries(headers.map((header, index) => [header.trim(), normalizedValues[index] || '']))
    })
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function writeCsv(filePath, rows) {
  const headers = [
    'company_name',
    'buyer_type',
    'target_person',
    'target_role',
    'website',
    'best_email',
    'best_email_type',
    'best_email_confidence',
    'best_email_verification',
    'email_source',
    'route_email',
    'source_url',
    'route_source_url',
    'enrichment_status',
    'enrichment_provider_status',
    'hunter_pattern',
    'hunter_candidates',
    'notes',
  ]
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${[headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n')}\n`)
}

function domainFromWebsite(website) {
  try {
    return new URL(String(website || '').startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function fullNameParts(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function candidateName(candidate) {
  return [candidate.first_name, candidate.last_name].filter(Boolean).join(' ').trim()
}

function nameMatches(candidate, targetPerson) {
  const candidateText = candidateName(candidate).toLowerCase()
  const tokens = String(targetPerson || '').toLowerCase().split(/[^a-z]+/).filter((token) => token.length > 1)
  return tokens.length >= 2 && tokens.every((token) => candidateText.includes(token))
}

function rankDomainCandidate(candidate, targetPerson) {
  let score = Number(candidate.confidence || 0)
  const position = String(candidate.position || '')
  const department = String(candidate.department || '')
  const email = cleanEmail(candidate.value)
  if (nameMatches(candidate, targetPerson)) score += 100
  if (/(acquisition|investment|capital|real estate|asset|portfolio|growth|development|partnership)/i.test(`${position} ${department}`)) score += 25
  if (/(director|vice president|vp|president|managing director|partner|chief|head|founder)/i.test(position)) score += 15
  if (/^(info|contact|support|help|privacy|media|press|ir|investorrelations)@/i.test(email)) score -= 20
  if (/noreply|donotreply|postmaster|abuse/i.test(email)) score -= 80
  return score
}

async function hunterGet(pathname, params, apiKey) {
  const url = new URL(`https://api.hunter.io/v2/${pathname}`)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  url.searchParams.set('api_key', apiKey)
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'VestBlock Institutional Contact Enrichment/1.0 (+https://vestblock.io)',
    },
    signal: AbortSignal.timeout(15000),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false, status: response.status, payload }
  }
  return { ok: true, status: response.status, payload }
}

async function enrichRow(row, apiKey, domainCache) {
  const domain = domainFromWebsite(row.website)
  let finder = null
  const nameParts = fullNameParts(row.target_person)
  if (apiKey && domain && nameParts && !/team|department|relations|partnerships/i.test(row.target_person)) {
    finder = await hunterGet('email-finder', { domain, full_name: row.target_person }, apiKey)
  }

  let foundEmail = ''
  let foundType = ''
  let confidence = ''
  let verification = ''
  let emailSource = ''
  let status = 'no_direct_person_email'
  const providerErrors = []

  const finderData = finder?.payload?.data || {}
  if (finder?.ok && finderData.email) {
    foundEmail = cleanEmail(finderData.email)
    foundType = 'named_person'
    confidence = String(finderData.score ?? finderData.confidence ?? '')
    verification = finderData.verification?.status || ''
    emailSource = 'hunter_email_finder'
    status = 'direct_person_email_found'
  } else if (finder && !finder.ok) {
    providerErrors.push(`email-finder:${finder.status}`)
  }

  if (!domainCache.has(domain)) {
    domainCache.set(domain, apiKey && domain ? hunterGet('domain-search', { domain, limit: '100' }, apiKey) : Promise.resolve(null))
  }
  const domainResult = await domainCache.get(domain)
  if (domainResult && !domainResult.ok) providerErrors.push(`domain-search:${domainResult.status}`)
  const domainData = domainResult?.payload?.data || {}
  const candidates = (domainData.emails || [])
    .filter((candidate) => candidate.value)
    .map((candidate) => ({
      ...candidate,
      score: rankDomainCandidate(candidate, row.target_person),
    }))
    .sort((a, b) => b.score - a.score)

  if (!foundEmail && candidates.length) {
    const best = candidates[0]
    foundEmail = cleanEmail(best.value)
    foundType = nameMatches(best, row.target_person) ? 'named_domain_match' : 'domain_candidate'
    confidence = String(best.confidence ?? '')
    verification = best.verification?.status || ''
    emailSource = 'hunter_domain_search'
    status = foundType === 'named_domain_match' ? 'direct_person_email_found' : 'domain_candidate_found'
  }

  if (!foundEmail && row.route_email) {
    foundEmail = cleanEmail(row.route_email)
    foundType = 'routing_inbox'
    confidence = 'public_source'
    verification = 'public_source'
    emailSource = 'public_route_email'
    status = 'routing_email_only'
  }

  if (!foundEmail && providerErrors.some((item) => item.endsWith(':429'))) {
    status = 'provider_limited_contact_form_only'
  }

  return {
    company_name: row.company_name,
    buyer_type: row.buyer_type,
    target_person: row.target_person,
    target_role: row.target_role,
    website: row.website,
    best_email: foundEmail,
    best_email_type: foundType,
    best_email_confidence: confidence,
    best_email_verification: verification,
    email_source: emailSource,
    route_email: row.route_email,
    source_url: row.source_url,
    route_source_url: row.route_source_url,
    enrichment_status: status,
    enrichment_provider_status: providerErrors.join('; '),
    hunter_pattern: domainData.pattern || '',
    hunter_candidates: candidates
      .slice(0, 5)
      .map((candidate) => `${candidateName(candidate) || 'Unknown'} <${cleanEmail(candidate.value)}> ${candidate.position || ''}`.trim())
      .join('; '),
    notes: row.notes,
  }
}

async function main() {
  const inputPath = getArg('--input', 'data/institutional-buyers/institutional-contact-seeds-2026-07-12.csv')
  const outDir = getArg('--out-dir', 'data/institutional-buyers/enriched')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputPath = path.join(outDir, `institutional-contact-enriched-${stamp}.csv`)
  const summaryPath = path.join(outDir, `institutional-contact-enriched-${stamp}.json`)
  const rows = parseCsv(fs.readFileSync(inputPath, 'utf8'))
  const apiKey = process.env.HUNTER_API_KEY?.trim() || ''
  const domainCache = new Map()
  const enriched = []

  for (let index = 0; index < rows.length; index += 1) {
    enriched.push(await enrichRow(rows[index], apiKey, domainCache))
    console.log(`enriched ${index + 1}/${rows.length}`)
  }

  writeCsv(outputPath, enriched)
  const summary = {
    ok: true,
    inputPath,
    outputPath,
    summaryPath,
    rows: rows.length,
    directPersonEmails: enriched.filter((row) => row.enrichment_status === 'direct_person_email_found').length,
    domainCandidates: enriched.filter((row) => row.enrichment_status === 'domain_candidate_found').length,
    routingOnly: enriched.filter((row) => row.enrichment_status === 'routing_email_only').length,
    providerLimited: enriched.filter((row) => String(row.enrichment_provider_status || '').includes(':429')).length,
    noDirectOrRoute: enriched.filter((row) => !row.best_email).length,
  }
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
