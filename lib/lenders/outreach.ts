import { CATEGORY_LABELS } from '@/lib/lenders/constants'
import type { GeneratedLenderOutreachBundle, LenderRecord } from '@/lib/lenders/types'

const OUTREACH_SIGNATURE = 'Robert Sanders\nVestBlock\nacquisitions@vestblock.io'
export const LENDER_OUTREACH_TEMPLATE_VERSION = 'vestblock-lender-network-2026-09-14'

function introAngle(lender: LenderRecord) {
  if (lender.lender_type === 'real_estate') {
    return 'VestBlock organizes borrower and property criteria before making a lender introduction, so the file arrives with a clear use of funds and financing request.'
  }
  if (lender.lender_type === 'personal') {
    return 'VestBlock helps people understand their credit and capital options, then routes qualified requests to lenders whose published criteria fit.'
  }
  if (lender.category === 'cdfi' || lender.category === 'community_bank' || lender.category === 'credit_union_business') {
    return 'VestBlock helps business owners clarify their capital request and documentation before a lender introduction.'
  }
  return 'VestBlock organizes business and borrower funding requests before making a lender introduction, so each request has a defined use of funds and a clearer fit.'
}

function referralAngle(lender: LenderRecord) {
  if (lender.lender_type === 'real_estate') {
    return 'We are mapping active criteria for acquisition, bridge, rehab, DSCR, construction, and long-term financing so we can distinguish a plausible fit from a file that should not be sent.'
  }
  if (lender.spanish_support) {
    return 'We also want to record whether your team supports Spanish-first borrowers so those requests reach the right intake path.'
  }
  if (lender.startup_allowed) {
    return 'We want to document how your team evaluates early-stage businesses, including any revenue, operating-history, collateral, or guarantor requirements.'
  }
  return 'We are documenting each partner’s active products, eligibility thresholds, geography, and exclusions before routing an opportunity.'
}

function greeting(lender: LenderRecord) {
  const name = String(lender.contact_name || '').trim()
  if (!name) return 'Hi there,'
  return `Hi ${name.split(/\s+/)[0]},`
}

function spanishGreeting(lender: LenderRecord) {
  const name = String(lender.contact_name || '').trim()
  if (!name) return 'Hola,'
  return `Hola ${name.split(/\s+/)[0]},`
}

function qualificationQuestions(lender: LenderRecord) {
  const base = [
    'Active states or service areas',
    'Products and typical funding range',
    'Minimum borrower or business requirements',
    'Firm exclusions or disqualifying conditions',
    'Referral contact and preferred intake process',
  ]

  if (lender.lender_type === 'real_estate') {
    return [...base, 'Property, occupancy, leverage, seasoning, and experience requirements']
  }
  if (lender.lender_type === 'business') {
    return [...base, 'Revenue, time-in-business, industry, collateral, and guarantor requirements']
  }
  if (lender.lender_type === 'personal') {
    return [...base, 'Credit, income, collateral, and recent-credit-event requirements']
  }
  return [...base, 'Program-specific eligibility and documentation requirements']
}

function economicsPrompt(lender: LenderRecord) {
  if (lender.category === 'community_bank' || lender.category === 'credit_union_business' || lender.category === 'credit_union_personal') {
    return 'If you use a formal, non-compensated referral process, we will follow it.'
  }
  return 'If you have a formal partner or broker process, please include the applicable onboarding, licensing, disclosure, and compensation requirements.'
}

export function generateLenderOutreach(lender: LenderRecord): GeneratedLenderOutreachBundle {
  const label = CATEGORY_LABELS[lender.category] || lender.category
  const partnershipAngle = introAngle(lender)
  const borrowerReferralAngle = referralAngle(lender)
  const questions = qualificationQuestions(lender)
  const economics = economicsPrompt(lender)
  const cta = 'A product guide, criteria sheet, or intake link is enough to begin.'
  const complianceNote =
    'VestBlock routes opportunities based on stated criteria and truthful applicant information; an introduction is not an approval or promise of volume. If this is not relevant, reply opt out and we will not contact you again.'

  return {
    generatedWith: 'template',
    emailIntro: {
      subject: 'Fit criteria for VestBlock referrals',
      body: `${greeting(lender)}\n\n${partnershipAngle}\n\n${borrowerReferralAngle}\n\nCould you send your current service area, products, typical funding range, minimum requirements, and firm exclusions? ${cta}\n\nIf someone else manages referral relationships, please point me to them.\n\nThanks,\n${OUTREACH_SIGNATURE}`,
      cta,
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    emailFollowup: {
      subject: 'Your current lending criteria',
      body: `${greeting(lender)}\n\nFollowing up on my earlier note. Before VestBlock routes a borrower, business, or property request to ${lender.name}, we want to record the criteria your team is actively using.\n\nA product guide or a short reply with your service area, products, typical funding range, minimum requirements, and exclusions is enough. If you are not accepting referral relationships, tell me and I will close the record.\n\n${economics}\n\nThanks,\n${OUTREACH_SIGNATURE}`,
      cta: 'Send your current criteria or tell us to close the record.',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    linkedInDm: {
      body: `Hi — I’m documenting active ${label} criteria for VestBlock and came across ${lender.name}. We organize funding requests before a lender introduction and want to record your service area, products, minimum requirements, and exclusions. Is there a criteria sheet or referral contact I should use?`,
      cta: 'Is there a criteria sheet or referral contact I should use?',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    phoneScript: {
      body: `Hi, this is Robert with VestBlock. We organize funding requests before making a lender introduction. I’m calling to find the person who manages ${label} criteria or referral relationships for ${lender.name}. We want to record your active service area, products, minimum requirements, exclusions, and preferred intake process before sending a request.`,
      cta: 'Who manages your lending criteria or referral intake?',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    spanishEmail: {
      subject: 'Criterios vigentes para referidos de VestBlock',
      body: `${spanishGreeting(lender)}\n\nVestBlock organiza solicitudes de financiamiento antes de presentar una oportunidad a un prestamista. Queremos registrar los criterios que ${lender.name} utiliza actualmente para enviar únicamente solicitudes con una posibilidad razonable de encaje.\n\n¿Puede compartir los estados o áreas que atiende, productos, rango habitual, requisitos mínimos, exclusiones y proceso de ingreso? Una guía de productos, hoja de criterios o enlace de solicitud es suficiente.\n\nSi otra persona gestiona las relaciones de referidos, le agradecería que me indicara con quién hablar.\n\nGracias,\n${OUTREACH_SIGNATURE}`,
      cta: 'Una guía de productos, hoja de criterios o enlace de solicitud es suficiente.',
      partnershipAngle,
      borrowerReferralAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
  }
}
