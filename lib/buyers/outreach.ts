import { CATEGORY_LABELS } from '@/lib/buyers/constants'
import type { BuyerRecord, GeneratedBuyerOutreachBundle } from '@/lib/buyers/types'

const OUTREACH_SIGNATURE = 'Robert Sanders\nVestBlock\nacquisitions@vestblock.io'
export const BUYER_OUTREACH_TEMPLATE_VERSION = 'vestblock-buyer-box-2026-07-14'

function bulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function introAngle(buyer: BuyerRecord) {
  if (buyer.buyer_type === 'institutional') {
    return 'We organize seller opportunities before they ever reach an acquisitions desk, so institutional teams see cleaner submissions, clearer context, and tighter market fit.'
  }
  if (buyer.category === 'wholesaler_buyer' || buyer.category === 'creative_finance_buyer') {
    return 'We are building an active operator bench for off-market and creative real-estate opportunities, and we want to route deals to buyers who can actually move on them.'
  }
  return 'We help organize seller, code-violation, tired-landlord, and distressed-property opportunities before they reach a buyer, so your team sees cleaner, better-fit deals.'
}

function propertyReferralAngle(buyer: BuyerRecord) {
  if (buyer.category === 'hedge_fund_buyer' || buyer.category === 'sfr_aggregator') {
    return 'A meaningful slice of our pipeline includes stabilized or lightly distressed single-family opportunities that may fit institutional acquisition criteria.'
  }
  if (buyer.category === 'build_to_rent_buyer') {
    return 'We also see land and infill opportunities that may fit build-to-rent acquisition conversations.'
  }
  return 'Our goal is to route seller opportunities into the right lane — fast cash, creative, novation, or investor resale — instead of spraying deals to the wrong list.'
}

function qualificationQuestions(buyer: BuyerRecord) {
  const base = [
    'Which cities, states, or ZIP clusters are you actively buying in right now?',
    'What property types do you most want more of?',
    'What are your hard no-go items that would save both sides time?',
    'Who handles acquisitions or partner submissions on your team?',
  ]

  if (buyer.category === 'hedge_fund_buyer' || buyer.category === 'sfr_aggregator' || buyer.category === 'build_to_rent_buyer') {
    return [
      ...base,
      'What pricing bands or portfolio thresholds matter most for your team?',
      'Do you require occupied, rent-ready, or institutional-grade inventory?',
      'What proof-of-funds or intake format should we follow when a match is worth showing?',
    ]
  }

  return [
    ...base,
    'How distressed can a property be and still make sense for you?',
    'Are tenant-occupied or code-violation deals workable?',
    'What closing timeline is realistic when a deal fits?',
  ]
}

function economicsPrompt(buyer: BuyerRecord) {
  if (buyer.buyer_type === 'institutional') {
    return 'If your team has a formal acquisitions intake, NDA, or approved referral path, we are glad to work inside that structure.'
  }
  return 'If you already have a preferred referral structure, intake sheet, or dispositions process, we are happy to work inside it and keep submissions clean.'
}

export function generateBuyerOutreach(buyer: BuyerRecord): GeneratedBuyerOutreachBundle {
  const label = CATEGORY_LABELS[buyer.category] || buyer.category
  const partnershipAngle = introAngle(buyer)
  const propertyAngle = propertyReferralAngle(buyer)
  const questions = qualificationQuestions(buyer)
  const economics = economicsPrompt(buyer)
  const complianceNote =
    'VestBlock sends property opportunities only when they appear to fit the criteria provided. If this is not relevant, reply and we will not contact you again.'
  const market = [buyer.headquarters_city, buyer.headquarters_state].filter(Boolean).join(', ') || 'your active markets'

  return {
    generatedWith: 'template',
    emailIntro: {
      subject: `What is your current buy box for ${market}?`,
      body: `Hi ${buyer.contact_name || buyer.name} team,\n\nI’m Robert with VestBlock. We source on-market and off-market property opportunities, then route them by location, asset type, condition, price range, and deal structure.\n\nI found ${buyer.name} while building our buyer coverage for ${market}. Before we send anything, could you reply with:\n- cities or ZIP codes you are buying in\n- property types and price range\n- rehab or occupancy limits\n- cash, subject-to, seller-finance, or hybrid structures you will consider\n\nIf you already have a buy-box sheet or acquisitions form, send that instead. We will record it and only bring you opportunities that appear to fit.\n\nIf this is not relevant, reply and we will not contact you again.\n\nThanks,\n${OUTREACH_SIGNATURE}`,
      cta: 'Reply with your buy box or acquisitions intake link and we will route matching opportunities to you.',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    emailFollowup: {
      subject: `Still buying in ${market}?`,
      body: `Hi ${buyer.contact_name || buyer.name} team,\n\nFollowing up once on my note about routing matching property opportunities to ${buyer.name}. A short reply with your active markets, property types, price range, and acceptable deal structures is enough for us to build your buy box.\n\n${economics}\n\nIf this is not relevant, reply and we will not contact you again.\n\nThanks,\n${OUTREACH_SIGNATURE}`,
      cta: 'A short reply with your buy box or acquisitions process is enough for us to get started.',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    linkedInDm: {
      body: `Hi, I’m building out VestBlock’s buyer network and came across ${buyer.name}. We help route seller opportunities by market, fit, and buyer criteria instead of blasting deals to a list. If your team is open to acquisitions or partner conversations for ${label}, I’d love to compare notes on your buy box, target markets, and hard no-go items.`,
      cta: 'Open to a quick buy-box conversation?',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    phoneScript: {
      body: `Hi, this is VestBlock. We help organize seller, code-violation, and distressed-property opportunities before they reach a buyer, and I’m calling to see who handles acquisitions or partner conversations for ${buyer.name}. We’d rather understand your real buy box than send mismatched deals. The main things we’d want to know are markets served, property types, distress tolerance, close speed, and whether there is a formal submissions process.`,
      cta: 'Who is the right person for acquisitions or partner submissions?',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    spanishEmail: {
      subject: `VestBlock y su criterio de compra para ${label}`,
      body: `Hola ${buyer.contact_name || 'equipo'},\n\nLe escribo de VestBlock. Ayudamos a organizar oportunidades de vendedores, propiedades con violaciones y propiedades en dificultad antes de conectarlas con un comprador.\n\nEstamos creando una red nacional de compradores y nos interesa entender qué mercados, tipos de propiedad y nivel de dificultad prefieren ustedes para ${label}. Así podemos enviar únicamente oportunidades que realmente tengan sentido.\n\nTambién podemos apoyar a socios serios con un AEO/SEO Booster cuando su posicionamiento y criterios ya estén claros.\n\nNormalmente queremos entender cosas como:\n${bulletList([
        'Ciudades, estados o zonas donde compran activamente',
        'Tipos de propiedades que prefieren',
        'Requisitos mínimos o casos que no aceptan',
        'Persona encargada de adquisiciones o alianzas',
      ])}\n\nSi manejan un proceso formal de envíos o de aliados, con gusto nos adaptamos a ese proceso.\n\nGracias,\n${OUTREACH_SIGNATURE}`,
      cta: '¿Están abiertos a una breve conversación sobre adquisiciones y referidos?',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
  }
}
