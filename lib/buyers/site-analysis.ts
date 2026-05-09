import { safeUrl } from '@/lib/leads/utils'
import { analyzeWebsiteWeakness } from '@/lib/leads/website-analysis'
import type { BuyerCategory } from '@/lib/buyers/types'

type BuyerSiteAnalysis = {
  websiteExists: boolean
  responseTimeMs: number | null
  contactEmail: string | null
  contactPhone: string | null
  categories: BuyerCategory[]
  bilingualSupport: boolean
  spanishSupport: boolean
  likelyInstitutional: boolean
  proofOfFundsSignal: string | null
  closingSpeed: string | null
  summary: string
  notes: string[]
  websiteAudit: Record<string, unknown>
}

const CATEGORY_KEYWORDS: Array<{ category: BuyerCategory; patterns: RegExp[] }> = [
  { category: 'local_cash_buyer', patterns: [/cash home buyer/i, /we buy houses/i, /cash offer/i] },
  { category: 'hedge_fund_buyer', patterns: [/institutional buyer/i, /hedge fund/i, /fund acquisitions/i] },
  { category: 'sfr_aggregator', patterns: [/single[- ]family rental/i, /\bsfr\b/i, /rental portfolio/i] },
  { category: 'build_to_rent_buyer', patterns: [/build[- ]to[- ]rent/i] },
  { category: 'landlord_buyer', patterns: [/landlord/i, /rental investor/i] },
  { category: 'brrrr_buyer', patterns: [/\bbrrrr\b/i, /cash[- ]out refinance/i] },
  { category: 'fix_and_flip_buyer', patterns: [/fix[\s-]?and[\s-]?flip/i, /house flipper/i, /rehab/i] },
  { category: 'small_multifamily_buyer', patterns: [/multifamily/i, /apartment investor/i] },
  { category: 'wholesaler_buyer', patterns: [/wholesale/i, /assignment/i] },
  { category: 'note_buyer', patterns: [/note buyer/i, /non-performing note/i] },
  { category: 'creative_finance_buyer', patterns: [/subject to/i, /seller finance/i, /creative finance/i] },
  { category: 'land_buyer', patterns: [/land buyer/i, /vacant land/i, /lot buyer/i] },
  { category: 'commercial_buyer', patterns: [/commercial real estate/i, /retail/i, /office/i, /industrial/i] },
  { category: 'mobile_home_park_buyer', patterns: [/mobile home park/i] },
  { category: 'self_storage_buyer', patterns: [/self storage/i] },
  { category: 'mixed_use_buyer', patterns: [/mixed use/i] },
]

export async function analyzeBuyerWebsite(website?: string | null): Promise<BuyerSiteAnalysis> {
  const normalized = safeUrl(website)
  if (!normalized) {
    return {
      websiteExists: false,
      responseTimeMs: null,
      contactEmail: null,
      contactPhone: null,
      categories: [],
      bilingualSupport: false,
      spanishSupport: false,
      likelyInstitutional: false,
      proofOfFundsSignal: null,
      closingSpeed: null,
      summary: 'No working buyer website detected.',
      notes: ['No working buyer website detected'],
      websiteAudit: {},
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const startedAt = Date.now()

  try {
    const response = await fetch(normalized, {
      headers: { 'user-agent': 'VestBlock Buyer Network/1.0 (+https://www.vestblock.io)' },
      redirect: 'follow',
      signal: controller.signal,
    })
    const html = await response.text()
    const contactEmail = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0] || null
    const contactPhone = html.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || null
    const categories = CATEGORY_KEYWORDS.filter((entry) => entry.patterns.some((pattern) => pattern.test(html))).map((entry) => entry.category)
    const bilingualSupport = /bilingual|se habla/i.test(html)
    const spanishSupport = /español|espanol|se habla/i.test(html)
    const likelyInstitutional = /institutional|portfolio|fund|acquisitions team/i.test(html)
    const proofOfFundsSignal = /proof of funds/i.test(html) ? 'requested' : /cash buyer/i.test(html) ? 'cash-buyer signal' : null
    const closingSpeed =
      /7 days|10 days|14 days|fast close|quick close/i.test(html) ? 'fast' : /30 days|standard closing/i.test(html) ? 'standard' : null
    const websiteAudit = await analyzeWebsiteWeakness(normalized)
    const notes: string[] = []
    if (proofOfFundsSignal) notes.push(`Proof-of-funds signal: ${proofOfFundsSignal}`)
    if (closingSpeed) notes.push(`Closing speed signal: ${closingSpeed}`)
    if (likelyInstitutional) notes.push('Institutional acquisitions language found')
    if (spanishSupport) notes.push('Spanish-language support found')

    return {
      websiteExists: response.ok,
      responseTimeMs: Date.now() - startedAt,
      contactEmail,
      contactPhone,
      categories,
      bilingualSupport,
      spanishSupport,
      likelyInstitutional,
      proofOfFundsSignal,
      closingSpeed,
      summary: categories.length
        ? `Detected ${categories.slice(0, 4).join(', ')} from the buyer website.`
        : 'Public website reached, but buy-box category detection was limited.',
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
      bilingualSupport: false,
      spanishSupport: false,
      likelyInstitutional: false,
      proofOfFundsSignal: null,
      closingSpeed: null,
      summary: 'Website could not be reached during buyer analysis.',
      notes: ['Website could not be reached during buyer analysis'],
      websiteAudit: {},
    }
  } finally {
    clearTimeout(timeout)
  }
}
