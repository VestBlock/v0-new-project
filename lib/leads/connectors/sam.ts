import type { LeadRecord, NormalizedLeadInput } from '@/lib/leads/types'
import { searchSamOpportunitiesApi } from '@/lib/sam/api'

type SearchSamInput = {
  keyword: string
  naicsCodes: string[]
  solicitationTypes?: string[]
  setAsideCodes?: string[]
  agencyCodes?: string[]
  zip?: string
  city?: string
  state?: string
  postedFrom?: string
  postedTo?: string
  responseDeadlineFrom?: string
  responseDeadlineTo?: string
  daysBack: number
  limit: number
  existingBusinessLeads?: LeadRecord[]
}

function matchesOpportunity(lead: LeadRecord, opportunity: Record<string, any>) {
  const haystack = [
    lead.category,
    lead.business_name,
    lead.name,
    lead.notes,
    JSON.stringify(lead.form_data || {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const naics = String(opportunity.naicsCode || '').toLowerCase()
  const title = String(opportunity.title || '').toLowerCase()

  if (/restaurant|food truck/.test(haystack) && /(food|catering|concession)/.test(title)) return true
  if (/cleaning/.test(haystack) && /(janitorial|custodial|clean)/.test(title)) return true
  if (/contractor|construction/.test(haystack) && /(construction|renovation|facility|repair)/.test(title)) return true
  if (/tax|bookkeep|account/.test(haystack) && /(accounting|financial|audit)/.test(title)) return true
  if (/software|website|marketing|ai/.test(haystack) && /(it|software|digital|technology)/.test(title + naics)) return true
  return false
}

export async function searchSamOpportunities(input: SearchSamInput) {
  const to = input.postedTo || new Date().toISOString().slice(0, 10)
  const from =
    input.postedFrom ||
    new Date(Date.now() - input.daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const opportunities = await searchSamOpportunitiesApi({
    keywords: [input.keyword],
    naicsCodes: input.naicsCodes,
    solicitationTypes: input.solicitationTypes,
    setAsideCodes: input.setAsideCodes,
    agencyCodes: input.agencyCodes,
    state: input.state,
    zip: input.zip,
    postedFrom: from,
    postedTo: to,
    responseDeadlineFrom: input.responseDeadlineFrom,
    responseDeadlineTo: input.responseDeadlineTo,
    limit: input.limit,
  })
  const existingLeads = input.existingBusinessLeads || []

  const matched: NormalizedLeadInput[] = []
  for (const opportunity of opportunities) {
    const compatibleBusinesses = existingLeads.filter((lead) => matchesOpportunity(lead, opportunity))
    for (const business of compatibleBusinesses.slice(0, 3)) {
      matched.push({
        leadType: 'sam_opportunity',
        source: 'sam_contract_opportunities',
        sourceUrl: opportunity.uiLink || opportunity.links?.[0]?.href || 'https://sam.gov/content/opportunities',
        category: 'government_contracts',
        externalId: `${business.id}-${opportunity.noticeId || opportunity.solicitationNumber || opportunity.title}`,
        name: business.name,
        businessName: business.business_name || business.name,
        phone: business.phone,
        email: business.email,
        website: business.website,
        city: business.city || input.city || null,
        state: business.state || input.state || null,
        languageSignal: business.language_signal,
        painSignal: `Opportunity fit for ${opportunity.title || input.keyword}`,
        bestOffer: 'Gov Contract Readiness',
        marketSegment: 'government_contracts',
        outreachAngle: 'Bid readiness and subcontract opportunity support',
        contactInfo: {
          ...(business.contact_info || {}),
          pointOfContact: opportunity.pointOfContact || [],
          officeAddress: opportunity.officeAddress || {},
          organizationPath: opportunity.fullParentPathName || null,
        },
        formData: {
          matchedFromLeadId: business.id,
          solicitationNumber: opportunity.solicitationNumber || null,
          opportunityTitle: opportunity.title || null,
          postedDate: opportunity.postedDate || null,
          responseDeadline: opportunity.responseDeadLine || null,
          naicsCode: opportunity.naicsCode || null,
          setAside: opportunity.typeOfSetAsideDescription || opportunity.setAside || null,
        },
        metadata: {
          opportunity,
          matchedLeadId: business.id,
        },
      })
    }
  }

  return {
    matchedLeads: matched,
    opportunities,
  }
}
