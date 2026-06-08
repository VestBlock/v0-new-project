import { safeUrl } from '@/lib/leads/utils'
import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import type { LenderCategory } from '@/lib/lenders/types'

type LenderSiteAnalysis = {
  websiteExists: boolean
  responseTimeMs: number | null
  contactEmail: string | null
  contactPhone: string | null
  categories: LenderCategory[]
  startupAllowed: boolean
  investorAllowed: boolean
  ownerOccupiedAllowed: boolean
  bilingualSupport: boolean
  spanishSupport: boolean
  lowDoc: boolean
  cashOutAllowed: boolean
  firstTimeInvestorAllowed: boolean
  dscrDetected: boolean
  rehabDetected: boolean
  loanAmountMin: number | null
  loanAmountMax: number | null
  summary: string
  notes: string[]
  websiteAudit: Record<string, unknown>
}

const CATEGORY_KEYWORDS: Array<{ category: LenderCategory; patterns: RegExp[] }> = [
  { category: 'dscr', patterns: [/dscr/i, /debt service coverage/i, /rental cash flow/i] },
  { category: 'fix_and_flip', patterns: [/fix[\s-]?and[\s-]?flip/i, /rehab loan/i, /flip project/i] },
  { category: 'bridge', patterns: [/bridge loan/i, /bridge financing/i] },
  { category: 'hard_money', patterns: [/hard money/i, /asset-based lending/i] },
  { category: 'refinance', patterns: [/cash[- ]out/i, /refinance/i] },
  { category: 'brrrr_friendly', patterns: [/brrrr/i, /delayed financing/i, /seasoning/i] },
  { category: 'portfolio_bank', patterns: [/portfolio loan/i, /portfolio lending/i] },
  { category: 'construction', patterns: [/construction loan/i, /ground[- ]up/i] },
  { category: 'commercial', patterns: [/commercial real estate/i, /commercial loan/i] },
  { category: 'sba_504_real_estate', patterns: [/sba 504/i] },
  { category: 'heloc', patterns: [/heloc/i, /home equity/i] },
  { category: 'private_lender', patterns: [/private lender/i, /private capital/i] },
  { category: 'creative_finance_partner', patterns: [/seller finance/i, /subject to/i, /creative finance/i] },
  { category: 'startup_friendly', patterns: [/startup/i, /new business/i, /business launch/i] },
  { category: 'term_loan', patterns: [/term loan/i] },
  { category: 'line_of_credit', patterns: [/line of credit/i, /working capital line/i] },
  { category: 'sba_7a', patterns: [/sba 7\(a\)/i, /sba 7a/i] },
  { category: 'sba_microloan', patterns: [/microloan/i] },
  { category: 'revenue_based', patterns: [/revenue[- ]based/i, /merchant cash advance/i] },
  { category: 'invoice_factoring', patterns: [/factoring/i, /accounts receivable/i, /invoice financing/i] },
  { category: 'equipment_finance', patterns: [/equipment financing/i, /equipment loan/i] },
  { category: 'franchise_finance', patterns: [/franchise financing/i] },
  { category: 'restaurant_finance', patterns: [/restaurant/i, /hospitality/i] },
  { category: 'contractor_finance', patterns: [/contractor/i, /home service/i, /construction business/i] },
  { category: 'cdfi', patterns: [/community development financial institution/i, /\bcdfi\b/i] },
  { category: 'community_bank', patterns: [/community bank/i] },
  { category: 'credit_union_business', patterns: [/credit union/i, /member business/i] },
  { category: 'personal_loan', patterns: [/personal loan/i] },
  { category: 'debt_consolidation', patterns: [/debt consolidation/i] },
  { category: 'credit_union_personal', patterns: [/credit union/i, /share secured/i] },
  { category: 'secured_share_loan', patterns: [/share secured/i, /secured share/i] },
  { category: 'heloc_personal', patterns: [/home equity/i, /heloc/i] },
  { category: 'relationship_bank_line', patterns: [/relationship pricing/i, /existing customer/i] },
  { category: 'credit_builder_partner', patterns: [/credit builder/i] },
  { category: 'spanish_market', patterns: [/se habla español/i, /español/i, /bilingual/i] },
  { category: 'minority_business_program', patterns: [/minority-owned/i, /minority business/i] },
  { category: 'women_business_program', patterns: [/women-owned/i, /women business/i] },
  { category: 'immigrant_business_program', patterns: [/immigrant/i, /new american/i] },
  { category: 'economic_development', patterns: [/economic development/i] },
  { category: 'grant_support_partner', patterns: [/grant/i] },
  { category: 'nonprofit_microloan', patterns: [/nonprofit/i, /community program/i] },
  { category: 'medical_practice_finance', patterns: [/medical practice/i, /dental practice/i] },
  { category: 'auto_repair_finance', patterns: [/auto repair/i, /automotive/i] },
]

function normalizeAmount(match: RegExpMatchArray | null) {
  if (!match?.[1]) return null
  const raw = match[1].replace(/[$,]/g, '').toLowerCase()
  if (raw.endsWith('m')) return Math.round(Number(raw.slice(0, -1)) * 1_000_000)
  if (raw.endsWith('k')) return Math.round(Number(raw.slice(0, -1)) * 1_000)
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export async function analyzeLenderWebsite(website?: string | null): Promise<LenderSiteAnalysis> {
  const normalized = safeUrl(website)
  if (!normalized) {
    return {
      websiteExists: false,
      responseTimeMs: null,
      contactEmail: null,
      contactPhone: null,
      categories: [],
      startupAllowed: false,
      investorAllowed: false,
      ownerOccupiedAllowed: false,
      bilingualSupport: false,
      spanishSupport: false,
      lowDoc: false,
      cashOutAllowed: false,
      firstTimeInvestorAllowed: false,
      dscrDetected: false,
      rehabDetected: false,
      loanAmountMin: null,
      loanAmountMax: null,
      summary: 'No working lender website detected.',
      notes: ['No working lender website detected'],
      websiteAudit: {},
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const startedAt = Date.now()

  try {
    const response = await fetch(normalized, {
      headers: {
        'user-agent': 'VestBlock Lender Network/1.0 (+https://www.vestblock.io)',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    const html = await response.text()
    const lower = html.toLowerCase()
    const contactEmail = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0] || null
    const contactPhone = html.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || null
    const categories = CATEGORY_KEYWORDS.filter((entry) => entry.patterns.some((pattern) => pattern.test(html))).map((entry) => entry.category)
    const startupAllowed = /startup|new business|first[- ]year/i.test(html)
    const investorAllowed = /investor|rental property|investment property|dscr/i.test(html)
    const ownerOccupiedAllowed = /owner[- ]occupied|primary residence/i.test(html)
    const bilingualSupport = /bilingual|se habla/i.test(html)
    const spanishSupport = /español|espanol|se habla/i.test(html)
    const lowDoc = /low[- ]doc|streamlined|bank statement loan/i.test(html)
    const cashOutAllowed = /cash[- ]out|equity takeout/i.test(html)
    const firstTimeInvestorAllowed = /first[- ]time investor|new investor/i.test(html)
    const dscrDetected = /dscr|debt service coverage/i.test(html)
    const rehabDetected = /rehab|fix and flip|construction draw/i.test(html)
    const loanAmountMin = normalizeAmount(lower.match(/(?:loan amounts?|from)\s*\$?([\d,.]+k?m?)/i))
    const loanAmountMax = normalizeAmount(lower.match(/(?:up to|max(?:imum)? loan)\s*\$?([\d,.]+k?m?)/i))
    const websiteAudit = await analyzeWebsiteWeakness(normalized)
    const responseTimeMs = Date.now() - startedAt
    const notes: string[] = []
    if (startupAllowed) notes.push('Startup or new-business language found')
    if (investorAllowed) notes.push('Investor-focused language found')
    if (lowDoc) notes.push('Low-doc or bank-statement language found')
    if (cashOutAllowed) notes.push('Cash-out or refinance language found')
    if (spanishSupport) notes.push('Spanish-language support found')
    if (dscrDetected) notes.push('DSCR product language found')
    if (rehabDetected) notes.push('Rehab / fix-and-flip language found')

    return {
      websiteExists: response.ok,
      responseTimeMs,
      contactEmail,
      contactPhone,
      categories,
      startupAllowed,
      investorAllowed,
      ownerOccupiedAllowed,
      bilingualSupport,
      spanishSupport,
      lowDoc,
      cashOutAllowed,
      firstTimeInvestorAllowed,
      dscrDetected,
      rehabDetected,
      loanAmountMin,
      loanAmountMax,
      summary: categories.length
        ? `Detected ${categories.slice(0, 4).join(', ')} from the lender website.`
        : 'Public website reached, but product category detection was limited.',
      notes: [...notes, ...websiteAudit.weakSignals],
      websiteAudit,
    }
  } catch {
    return {
      websiteExists: false,
      responseTimeMs: null,
      contactEmail: null,
      contactPhone: null,
      categories: [],
      startupAllowed: false,
      investorAllowed: false,
      ownerOccupiedAllowed: false,
      bilingualSupport: false,
      spanishSupport: false,
      lowDoc: false,
      cashOutAllowed: false,
      firstTimeInvestorAllowed: false,
      dscrDetected: false,
      rehabDetected: false,
      loanAmountMin: null,
      loanAmountMax: null,
      summary: 'Website could not be reached during lender analysis.',
      notes: ['Website could not be reached during lender analysis'],
      websiteAudit: {},
    }
  } finally {
    clearTimeout(timeout)
  }
}
