import { CATEGORY_LABELS } from '@/lib/lenders/constants'
import type { GeneratedLenderOutreachBundle, LenderRecord } from '@/lib/lenders/types'

const OUTREACH_SIGNATURE = 'Robert Sanders\nVestBlock\nacquisitions@vestblock.io'
export const LENDER_OUTREACH_TEMPLATE_VERSION = 'vestblock-lender-refresh-2026-06-11'

function bulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function introAngle(lender: LenderRecord) {
  if (lender.lender_type === 'real_estate') {
    return 'We help organize operators and real-estate deals before they reach a lender, so your team sees cleaner files and better-fit submissions.'
  }
  if (lender.lender_type === 'personal') {
    return 'We help sort borrowers into better-fit cleanup, consolidation, and credit-ready next steps before introductions are made.'
  }
  if (lender.category === 'cdfi' || lender.category === 'community_bank' || lender.category === 'credit_union_business') {
    return 'We work with small-business owners who often need guidance, document prep, and cleaner routing before they approach a community lender.'
  }
  return 'We help organize funding-ready borrowers before they reach a lender, so your team spends more time on fits and less time on mismatched inquiries.'
}

function referralAngle(lender: LenderRecord) {
  if (lender.lender_type === 'real_estate') {
    return 'The opportunities we would route over are typically investors, BRRRR borrowers, rental operators, rehab cases, bridge scenarios, or deal-specific real-estate borrowers who need a better lender fit.'
  }
  if (lender.spanish_support) {
    return 'We also support Spanish-speaking borrowers and can help make introductions cleaner for bilingual or Spanish-first lending conversations.'
  }
  if (lender.startup_allowed) {
    return 'A good portion of our opportunity is startup and early-stage borrowers who need to be routed carefully instead of sprayed across random lender lists.'
  }
  return 'Our goal is to route cleaner, better-aligned borrower opportunities to the right capital partner instead of throwing weak inquiries into the market.'
}

function callToAction(lender: LenderRecord) {
  return lender.contact_name
    ? `If it makes sense, I’d love to compare notes with ${lender.contact_name} on what your team actually likes to see in a referral.`
    : 'If it makes sense, I’d love to compare notes on the borrower profiles and deal types your team actually likes to see.'
}

function qualificationQuestions(lender: LenderRecord) {
  const base = [
    'Which states are you actively lending in right now?',
    'What borrower profile or deal type do you most want more of?',
    'What are your hard no-go items that would save both sides time?',
    'Who on your team handles partner or referral relationships?',
  ]

  if (lender.lender_type === 'real_estate') {
    return [
      ...base,
      'Do you prefer owner-occupied, investor, or both?',
      'Any DSCR, seasoning, LTV/LTC, or cash-out rules we should know up front?',
      'Are first-time investors or rehab-heavy projects workable for you?',
    ]
  }

  if (lender.lender_type === 'business') {
    return [
      ...base,
      'What minimum revenue or time-in-business matters most for your team?',
      'Do you like startups, established operators, or both?',
      'Are there industries you strongly prefer or avoid?',
    ]
  }

  if (lender.lender_type === 'personal') {
    return [
      ...base,
      'Do you mainly handle consolidation, unsecured personal loans, or secured cleanup products?',
      'What score or recent-credit profile tends to work best?',
      'Any restrictions we should know before introducing cleanup-focused borrowers?',
    ]
  }

  return [
    ...base,
    'What communities or borrower groups are the best fit for your program?',
    'Do you offer bilingual or Spanish-first support for referred borrowers?',
  ]
}

function economicsPrompt(lender: LenderRecord) {
  if (lender.category === 'community_bank' || lender.category === 'credit_union_business' || lender.category === 'credit_union_personal') {
    return 'If you have a formal partner intake process or a non-compensated referral path, we would be glad to follow that structure.'
  }

  return 'If you already have a partner intake sheet, broker channel, or referral structure in states where that is permitted, I’d also love to understand how you handle onboarding, disclosures, and compensation.'
}

function demandEngineAngle(lender: LenderRecord) {
  if (lender.lender_type === 'real_estate') {
    return 'We also attach an AEO/SEO Booster to serious network partners once their positioning and lending box are clear, so the relationship is supported by more inbound visibility and not just manual outbound.'
  }

  return 'We also attach an AEO/SEO Booster to serious network partners once their positioning and fit box are clear, so the relationship is supported by more inbound visibility and not just manual outbound.'
}

export function generateLenderOutreach(lender: LenderRecord): GeneratedLenderOutreachBundle {
  const label = CATEGORY_LABELS[lender.category] || lender.category
  const partnershipAngle = introAngle(lender)
  const borrowerReferralAngle = referralAngle(lender)
  const cta = callToAction(lender)
  const questions = qualificationQuestions(lender)
  const economics = economicsPrompt(lender)
  const demandEngine = demandEngineAngle(lender)
  const subject = `VestBlock deals matched to your ${label} lending criteria`
  const followupSubject = `Quick follow-up on your VestBlock lending box`
  const complianceNote =
    'VestBlock positions referrals based on fit, readiness, and truthful borrower information. We do not promise approvals or misrepresent borrower files.'

  return {
    generatedWith: 'template',
    emailIntro: {
      subject,
      body: `Hi ${lender.contact_name || lender.name} team,\n\nI’m reaching out from VestBlock. ${partnershipAngle}\n\n${borrowerReferralAngle}\n\nWe are building a reliable lender network so we can route deals and borrowers more intelligently by state, product, credit profile, leverage, and documentation readiness.\n\nOn the seller and operator side, we are working opportunities through fast cash, creative, novation, bridge, rehab, DSCR, and long-term hold conversations. On the partner side, we want your real lending box so the right files move quickly.\n\n${demandEngine}\n\nIf it helps, these are the first things we usually want to understand before we ever send someone over:\n${bulletList(questions)}\n\n${cta}\n\nIf your team already has a one-pager, product sheet, or quick fit box, I’d be happy to organize that on our side and only send matches.\n\nThanks,\n${OUTREACH_SIGNATURE}`,
      cta,
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    emailFollowup: {
      subject: followupSubject,
      body: `Hi ${lender.contact_name || lender.name} team,\n\nWanted to circle back on my earlier note. We’re actively building out a cleaner lender network for ${label} and would rather understand your real fit box than send mismatched borrowers.\n\nWe are trying to build this the right way: cleaner seller and operator intake, sharper routing, better lender relationships, and optional AEO/SEO Booster support once a partner’s positioning is clear.\n\nEven a short reply with a few of these would help a lot:\n${bulletList(questions.slice(0, 5))}\n\n${economics}\n\nThanks again,\n${OUTREACH_SIGNATURE}`,
      cta: 'A short reply with your fit box or partner process is enough for us to get started.',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    linkedInDm: {
      body: `Hi, I’m building out VestBlock’s lender network and came across ${lender.name}. We help route cleaner deal and borrower opportunities by fit instead of blasting files across the wrong lenders. If your team is open to partner conversations for ${label}, I’d love to compare notes on your preferred fit box, states served, and hard no-go items.`,
      cta: 'Open to a quick lender-fit conversation?',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    phoneScript: {
      body: `Hi, this is VestBlock. We help organize and pre-qualify borrowers and real-estate deals before they reach a lender, and I’m calling to see who handles partnership or referral conversations for ${lender.name}. We’re especially looking for strong ${label} fit and would rather understand your real box than send mismatched files. The main things we’d want to know are states served, preferred borrower or deal types, deal-breakers, and whether there is a formal partner intake process.`,
      cta: 'Who is the best person for partner/referral conversations?',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    spanishEmail: {
      subject: `VestBlock y su criterio de colocación para ${label}`,
      body: `Hola ${lender.contact_name || 'equipo'},\n\nLe escribo de VestBlock. Ayudamos a organizar clientes y oportunidades inmobiliarias antes de conectarlos con un prestamista para que lleguen mejor preparados y con mejor ajuste.\n\nEstamos creando una red nacional de prestamistas y nos interesa entender qué tipos de clientes, estados y productos prefieren ustedes para ${label}. Así podemos enviar únicamente oportunidades que realmente tengan sentido.\n\nTambién podemos apoyar a socios serios con un AEO/SEO Booster cuando su posicionamiento y criterios ya estén claros.\n\nNormalmente queremos entender cosas como:\n${bulletList([
        'Estados donde prestan activamente',
        'Tipos de clientes o transacciones que prefieren',
        'Requisitos mínimos o casos que no aceptan',
        'Persona encargada de alianzas o referidos',
      ])}\n\nSi manejan un proceso formal de referidos o de incorporación de aliados, también con gusto nos adaptamos a ese proceso.\n\nGracias,\n${OUTREACH_SIGNATURE}`,
      cta: '¿Están abiertos a una breve conversación sobre alianzas y referidos?',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
  }
}
