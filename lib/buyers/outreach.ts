import { CATEGORY_LABELS } from '@/lib/buyers/constants'
import type { BuyerRecord, GeneratedBuyerOutreachBundle } from '@/lib/buyers/types'

const OUTREACH_SIGNATURE = 'Robert Sanders\nVestBlock\ncontact@vestblock.io'

function bulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function introAngle(buyer: BuyerRecord) {
  if (buyer.buyer_type === 'institutional') {
    return 'We help organize off-market seller and distressed-property opportunities before they ever reach an acquisitions desk, so your team sees cleaner submissions and better market fit.'
  }
  if (buyer.category === 'wholesaler_buyer' || buyer.category === 'creative_finance_buyer') {
    return 'We are building a buyer network for off-market and creative real-estate opportunities, and we want to route deals to operators who can actually move on them.'
  }
  return 'We help organize seller, distressed-property, tired-landlord, and code-violation opportunities before they reach a buyer, so your team sees cleaner, better-fit deals.'
}

function propertyReferralAngle(buyer: BuyerRecord) {
  if (buyer.category === 'hedge_fund_buyer' || buyer.category === 'sfr_aggregator') {
    return 'A meaningful slice of our pipeline includes stabilized or lightly distressed single-family opportunities that may fit institutional acquisition criteria.'
  }
  if (buyer.category === 'build_to_rent_buyer') {
    return 'We also see land and infill opportunities that may fit build-to-rent acquisition conversations.'
  }
  return 'Our goal is to route cleaner seller opportunities, code-violation properties, and distressed inventory to the right buyer instead of spraying deals to the wrong list.'
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
  return 'If you already have a dispo or referral structure where that is permitted, I’d also love to understand how you handle submissions, partner expectations, and compensation.'
}

function demandEngineAngle(buyer: BuyerRecord) {
  if (buyer.buyer_type === 'institutional') {
    return 'We also run automated SEO and content systems that help surface inbound seller and distressed-property demand before it gets widely shopped, so the pipeline is not just manual outreach or list-building.'
  }

  return 'We also run automated SEO and content systems that help surface motivated seller and distressed-property demand before it gets widely shopped, so the pipeline is not just manual outreach or list-building.'
}

export function generateBuyerOutreach(buyer: BuyerRecord): GeneratedBuyerOutreachBundle {
  const label = CATEGORY_LABELS[buyer.category] || buyer.category
  const partnershipAngle = introAngle(buyer)
  const propertyAngle = propertyReferralAngle(buyer)
  const questions = qualificationQuestions(buyer)
  const economics = economicsPrompt(buyer)
  const demandEngine = demandEngineAngle(buyer)
  const complianceNote =
    'VestBlock positions property opportunities based on fit, seller context, and truthful deal information. We do not promise volume, assignment rights, or guaranteed deal outcomes.'

  return {
    generatedWith: 'template',
    emailIntro: {
      subject: `VestBlock buyer-network partnership for ${label} opportunities`,
      body: `Hi ${buyer.contact_name || buyer.name} team,\n\nI’m reaching out from VestBlock. ${partnershipAngle}\n\n${propertyAngle}\n\nWe are building out a buyer network across the U.S. so we can route seller leads and distressed-property opportunities more intelligently by market, asset type, and acquisition criteria.\n\n${demandEngine}\n\nIf it helps, these are the first things we usually want to understand before we ever send a property over:\n${bulletList(questions)}\n\nIf your team already has a buy box, acquisitions one-pager, or a preferred intake format, I’d be happy to organize that on our side and only send cleaner matches.\n\nThanks,\n${OUTREACH_SIGNATURE}`,
      cta: 'Open to a quick conversation about your buy box and acquisition criteria?',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    emailFollowup: {
      subject: 'Quick follow-up on VestBlock seller and distressed-property referrals',
      body: `Hi ${buyer.contact_name || buyer.name} team,\n\nWanted to circle back on my earlier note. We’re actively building a cleaner buyer network for ${label} and would rather understand your real acquisition box than send mismatched deals.\n\nA meaningful part of that pipeline comes from our automated SEO and content systems, which helps us create inbound seller and distressed-property demand instead of relying only on cold outreach.\n\nEven a short reply with a few of these would help a lot:\n${bulletList(questions.slice(0, 5))}\n\n${economics}\n\nThanks again,\n${OUTREACH_SIGNATURE}`,
      cta: 'A short reply with your buy box or acquisitions process is enough for us to get started.',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    linkedInDm: {
      body: `Hi, I’m building out VestBlock’s buyer network and came across ${buyer.name}. We help route cleaner seller and distressed-property opportunities by market and fit. If your team is open to acquisitions or referral conversations for ${label}, I’d love to compare notes on your buy box, target markets, and any hard no-go items.`,
      cta: 'Open to a quick buy-box conversation?',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: null,
    },
    phoneScript: {
      body: `Hi, this is VestBlock. We help organize seller, distressed-property, and code-violation opportunities before they reach a buyer, and I’m calling to see who handles acquisitions or referral conversations for ${buyer.name}. We’d rather understand your real buy box than send mismatched deals. The main things we’d want to know are markets served, property types, distress tolerance, and whether there is a formal submissions process.`,
      cta: 'Who is the right person for acquisitions or partner submissions?',
      partnershipAngle,
      propertyReferralAngle: propertyAngle,
      complianceNote,
      qualificationQuestions: questions,
      economicsPrompt: economics,
    },
    spanishEmail: {
      subject: `Posible alianza con VestBlock para oportunidades de ${label}`,
      body: `Hola ${buyer.contact_name || 'equipo'},\n\nLe escribo de VestBlock. Ayudamos a organizar oportunidades de vendedores, propiedades en dificultad y propiedades con violaciones antes de conectarlas con un comprador.\n\nEstamos creando una red nacional de compradores y nos interesa entender qué mercados, tipos de propiedad y nivel de dificultad prefieren ustedes para ${label}. Así podemos enviar únicamente oportunidades que tengan sentido.\n\nTambién operamos sistemas automatizados de SEO y contenido que ayudan a generar demanda entrante de vendedores y propiedades con dificultad antes de que se ofrezcan ampliamente.\n\nNormalmente queremos entender cosas como:\n${bulletList([
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
