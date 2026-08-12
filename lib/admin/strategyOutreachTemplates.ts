import { OUTREACH_UNSUBSCRIBE_NOTES } from '@/lib/leads/constants'
import type { LeadRecord } from '@/lib/leads/types'

export type StrategyEmailDraft = {
  subject: string
  body: string
  cta: string
  complianceNote: string
}

const SIGNATURE = 'Robert Sanders\nVestBlock\nacquisitions@vestblock.io'

function identity(lead: LeadRecord) {
  return String(lead.name || lead.business_name || 'there').trim()
}

function address(lead: LeadRecord) {
  return String(lead.property_address || 'the property').trim()
}

function close(body: string, cta: string) {
  return `${body}\n\n${cta}\n\nBest,\n${SIGNATURE}`
}

export function buildStrategyEmailDraft(strategyKey: string, lead: LeadRecord): StrategyEmailDraft {
  const name = identity(lead)
  const property = address(lead)
  const standardCta = 'Reply with a good time for a brief conversation, or let me know if this is not relevant.'
  const templates: Record<string, { subject: string; body: string; cta?: string }> = {
    'active-stale-creative': {
      subject: `Would the seller consider flexible terms on ${property}?`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. If a standard cash offer is not the right fit, would the seller consider seller financing, a subject-to structure, or a hybrid of cash and terms?\n\nWe can adapt the structure to the existing debt, available equity, and the seller's timing. The goal is to find a workable path while keeping you involved and protecting your commission. Nothing is assumed or binding until the facts, title, and documents are reviewed by the appropriate professionals.`,
      cta: 'Would it be worth a short conversation about what terms the seller might consider?',
    },
    'preforeclosure-equity': {
      subject: `Options review for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. If the property has become difficult to keep, VestBlock can compare several possible paths, including a traditional sale, an as-is purchase, seller financing, or a subject-to structure when the existing loan and timing make that appropriate.\n\nThis is not a foreclosure-rescue promise or legal advice. Any option would require verified ownership, payoff information, title review, written disclosures, and the appropriate legal and closing professionals.`,
      cta: 'Reply if you would like to compare the available paths before deciding what to do next.',
    },
    'tax-code-stack': {
      subject: `A few sale options for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock can review an as-is purchase as well as flexible terms when a property needs repairs, cleanup, or a faster resolution.\n\nWe are not affiliated with a city, county, or tax authority, and I am not assuming you need to sell. I simply wanted to see whether comparing a direct sale with a terms-based option would be useful.`,
    },
    'tax-remote-equity-rotation': {
      subject: `Would selling ${property} remotely be useful?`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock works with owners who want to handle a property sale without repeated travel, showings, or local project management.\n\nDepending on the property and existing financing, we can review an as-is cash path, seller financing, or a hybrid structure. We are not affiliated with any government agency and are not assuming that you need to sell.`,
    },
    'lien-equity': {
      subject: `Possible paths for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. If title, payoff, or lien issues are making a sale harder, VestBlock can review whether an as-is purchase or a flexible structure could still work after the numbers are verified.\n\nNo outcome is guaranteed. We would need current payoff information, a title review, and a closing professional before discussing final terms.`,
    },
    'probate-vacant-equity': {
      subject: `A lower-friction path for ${property}`,
      body: `Hi ${name},\n\nI am reaching out respectfully about ${property}. When an inherited or estate property is sitting vacant, VestBlock can review an as-is purchase, flexible closing timing, and terms-based options without requiring the family to complete repairs or manage repeated showings.\n\nWe do not provide probate or legal advice. Any conversation would begin by confirming the authorized decision-maker and involving the appropriate estate, title, and closing professionals.`,
    },
    'portfolio-landlord': {
      subject: `Would you consider selling one or more properties?`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock works with rental owners who may want to sell one property, a small group, or an entire portfolio without taking every asset through a retail listing process.\n\nWe can review cash, seller financing, subject-to, or hybrid structures depending on debt, equity, occupancy, and timing. There is no need to decide on a structure before we understand the portfolio.`,
      cta: 'Reply with the property or group you would be most open to discussing.',
    },
    'small-multifamily-portfolio': {
      subject: `Acquisition options for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock is interested in small multifamily properties and smaller portfolios where the owner may prefer a direct transaction or flexible terms.\n\nWe can review cash, seller financing, subject-to, or a hybrid structure after confirming unit count, occupancy, rents, expenses, debt, and deferred maintenance.`,
    },
    'builder-infill-teardown': {
      subject: `Builder review for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock can review properties that may fit an infill, teardown, fire-damage, or unfinished-rehab buyer rather than a typical retail buyer.\n\nAny pricing would remain conditional on access, title, zoning, utilities, condition, and construction scope. We can also consider flexible terms when that creates a better result than a cash-only structure.`,
    },
    'land-wholesale': {
      subject: `Would you consider an offer on ${property}?`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock works with land buyers and builders who review vacant lots, acreage, and infill parcels.\n\nWe can consider cash or flexible terms, but any proposal would remain conditional on title, legal access, survey, zoning, utilities, environmental issues, and buildability.`,
    },
    'vacant-equity': {
      subject: `Would an as-is sale of ${property} be useful?`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. If the property is vacant or becoming a maintenance burden, VestBlock can compare an as-is cash purchase with seller-financing or hybrid terms.\n\nThere is no need to clean out or repair the property before an initial review, and no obligation to proceed after the numbers are discussed.`,
    },
    'seller-finance-free-clear': {
      subject: `Would flexible terms be useful for ${property}?`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. If the owner is open to an installment sale, VestBlock can review seller-financing terms that may create monthly income while avoiding a cash-only discount.\n\nAny proposal would depend on verified ownership, title, tax advice, the seller's goals, and written terms prepared with the appropriate professionals.`,
      cta: 'Would the owner be open to a short conversation about price, down payment, monthly income, and timing?',
    },
    'subject-to-low-equity': {
      subject: `A financing-based option for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. When a traditional cash offer does not leave enough room after the loan payoff, an existing-financing structure may be worth reviewing alongside a normal sale.\n\nNothing is assumed: a subject-to transaction requires current loan documents, title review, written disclosures about the due-on-sale clause and servicing, insurance review, and qualified legal and closing professionals.`,
      cta: 'Would it be useful to compare a standard sale with a properly documented existing-financing option?',
    },
    'hybrid-equity-bridge': {
      subject: `Cash plus terms for ${property}?`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock can review a hybrid structure that combines cash at closing with flexible terms for the remaining equity, depending on the existing loan and the seller's priorities.\n\nThe goal is to solve for price, immediate cash, monthly income, and timing rather than forcing every property into a deep cash discount.`,
    },
    'novation-retail-equity': {
      subject: `A retail-equity path for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. If the property has enough equity but a direct investor price is not attractive, VestBlock can review a retail-facing sale structure that may preserve more of the upside while keeping the terms, costs, access, and responsibilities clearly documented.\n\nAny novation-style path requires title and contract review and is not a guaranteed price or closing.`,
    },
    'absentee-equity-creative': {
      subject: `Remote sale options for ${property}`,
      body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock can compare an as-is sale, seller financing, existing-financing review, or a hybrid structure for owners who want to handle a property remotely.\n\nWe are not assuming the owner needs to sell; I am simply checking whether a low-friction remote option would be useful.`,
    },
  }

  const selected = templates[strategyKey] || {
    subject: `Options for ${property}`,
    body: `Hi ${name},\n\nI am reaching out about ${property}. VestBlock can compare an as-is cash purchase with seller-financing, subject-to, or hybrid terms depending on the property, existing debt, equity, and timing.\n\nNothing is assumed or binding until the facts and documents are reviewed.`,
  }
  const cta = selected.cta || standardCta

  return {
    subject: selected.subject,
    body: close(selected.body, cta),
    cta,
    complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.email,
  }
}
