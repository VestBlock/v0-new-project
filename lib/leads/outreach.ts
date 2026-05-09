import { createChatCompletion } from '@/lib/openai-service'
import { OUTREACH_UNSUBSCRIBE_NOTES } from '@/lib/leads/constants'
import { listActiveOutreachVariants } from '@/lib/improvement/repository'
import type {
  GeneratedOutreachBundle,
  LeadRecord,
  LeadScoreRecord,
  OutreachChannel,
} from '@/lib/leads/types'
import { truncate } from '@/lib/leads/utils'

const OUTREACH_SIGNATURE = 'Robert Sanders\nVestBlock\ncontact@vestblock.io'

function leadLanguage(lead: LeadRecord): 'en' | 'es' {
  return lead.language_segment === 'spanish' ||
    lead.language_signal?.toLowerCase().includes('spanish') ||
    lead.language_signal?.toLowerCase().includes('es')
    ? 'es'
    : 'en'
}

function isSellerAcquisitionLead(lead: LeadRecord) {
  const offer = String(lead.best_offer || '').toLowerCase()
  const realEstateStrategy = String(lead.metadata_json?.realEstateStrategy || lead.form_data?.realEstateStrategy || '').toLowerCase()
  const painText = `${lead.pain_signal || ''} ${lead.notes || ''} ${lead.status_detail || ''}`.toLowerCase()

  if (offer.includes('dealvault') || offer.includes('operator accountability')) {
    return false
  }

  return (
    lead.category === 'seller_lead' ||
    lead.category === 'code_violation' ||
    lead.lead_type === 'sell_house' ||
    realEstateStrategy.length > 0 ||
    ((lead.category === 'real_estate' || lead.lead_type === 'real_estate') &&
      /distress|vacant|violation|preforeclosure|probate|tax delinquent|seller|listing/.test(painText))
  )
}

function isDealVaultLead(lead: LeadRecord) {
  const offer = String(lead.best_offer || '').toLowerCase()
  const typeText = JSON.stringify({
    category: lead.category,
    businessName: lead.business_name,
    notes: lead.notes,
    pain: lead.pain_signal,
    metadata: lead.metadata_json,
    formData: lead.form_data,
  }).toLowerCase()

  return (
    offer.includes('dealvault') ||
    offer.includes('operator accountability') ||
    ((lead.category === 'real_estate' || lead.lead_type === 'real_estate') &&
      /contractor|rehab|property management|investor|referral|partner|jv|joint venture|seller finance|lease option|subject-to|creative finance|rental/.test(
        typeText
      ))
  )
}

function leadCta(lead: LeadRecord) {
  const realEstateStrategy = String(lead.metadata_json?.realEstateStrategy || lead.form_data?.realEstateStrategy || '').toLowerCase()
  if (isSellerAcquisitionLead(lead)) {
    if (realEstateStrategy === 'fast_cash') {
      return 'Reply if you want a simple as-is cash conversation on this property.'
    }
    if (realEstateStrategy === 'failed_listing') {
      return 'Reply if you want to compare a different sale path now that the listing did not move.'
    }
    if (realEstateStrategy === 'novation') {
      return 'Reply if you want to compare a higher-price novation-style path versus a direct investor sale.'
    }
    if (realEstateStrategy === 'creative_finance') {
      return 'Reply if you are open to creative terms, seller-finance ideas, or a flexible exit conversation.'
    }
    return 'Reply if you want to discuss a direct sale, investor review, or next-step options for this property.'
  }
  if ((lead.best_offer || '').toString().includes('Website')) {
    return 'Reply for a quick website improvement breakdown.'
  }
  if ((lead.best_offer || '').toString().includes('AI')) {
    return 'Reply if you want a quick automation review.'
  }
  if ((lead.best_offer || '').toString().includes('Real Estate')) {
    return 'Reply if you want to review options on this property.'
  }
  if (isDealVaultLead(lead)) {
    return 'Reply if you want a short DealVault walkthrough for agreement tracking, payout visibility, or milestone proof.'
  }
  if ((lead.best_offer || '').toString().includes('Gov Contract')) {
    return 'Reply if you want a short contract-readiness overview.'
  }
  return 'Reply if you want a short practical next-step review.'
}

function shouldMentionFundingBridge(lead: LeadRecord) {
  if (isSellerAcquisitionLead(lead)) return false
  const offer = String(lead.best_offer || '')
  const category = String(lead.category || '').toLowerCase()
  return (
    offer.includes('Business Setup') ||
    offer.includes('Business Credit') ||
    offer.includes('Grant') ||
    offer.includes('Spanish Funding') ||
    category === 'business_setup' ||
    category === 'business_credit' ||
    category === 'spanish_business'
  )
}

function fundingBridgeLine(lead: LeadRecord, language: 'en' | 'es') {
  if (!shouldMentionFundingBridge(lead)) return ''
  if (language === 'es') {
    return 'Si mejorar captacion, reservas, o presencia web abre una oportunidad mas grande, VestBlock tambien puede ayudarte a ordenar la preparacion para financiamiento sin promesas infladas.'
  }
  return 'If stronger lead capture, booking, or web conversion opens a larger growth opportunity, VestBlock can also help organize funding readiness without inflated promises.'
}

function bodyMentionsFunding(body: string) {
  return /\bfunding\b|\bfinance\b|\bcapital\b|financiamiento|credito|crédito/i.test(body)
}

function ensureFundingBridgeInEmailBody(body: string, lead: LeadRecord, language: 'en' | 'es') {
  const bridge = fundingBridgeLine(lead, language)
  if (!bridge || bodyMentionsFunding(body)) return body

  const trimmed = body.trim()
  const divider = language === 'es' ? '\n\nSaludos,' : '\n\nBest,'
  const dividerIndex = trimmed.lastIndexOf(divider)
  if (dividerIndex >= 0) {
    return `${trimmed.slice(0, dividerIndex).trim()}\n\n${bridge}${trimmed.slice(dividerIndex)}`
  }

  return `${trimmed}\n\n${bridge}`
}

function publicOfferLabel(lead: LeadRecord, fallbackOffer?: string | null) {
  if (isSellerAcquisitionLead(lead)) {
    return 'direct-sale and investor review options'
  }

  const offer = (fallbackOffer || lead.best_offer || '').toString()

  if (!offer) return 'practical operator support'
  if (offer.includes('AI Appointment Booking')) return 'appointment-booking automation'
  if (offer.includes('AI Receptionist')) return 'AI receptionist setup'
  if (offer.includes('Website')) return 'visibility expansion support'
  if (offer.includes('DealVault') || offer.includes('Operator Accountability')) {
    return 'DealVault agreement tracking, payout records, and milestone proof'
  }
  if (offer.includes('Business Funding')) return 'funding-readiness support'
  if (offer.includes('Business Credit')) return 'business-credit support'
  if (offer.includes('Grant')) return 'grant and funding roadmap support'
  if (offer.includes('Gov Contract')) return 'contract-readiness support'
  if (offer.includes('Spanish Funding')) return 'Spanish funding support'
  if (offer.includes('Business Setup')) return 'business setup and compliance help'

  return offer.toLowerCase()
}

async function pickVariantGuidance(
  lead: LeadRecord,
  channel: OutreachChannel,
  language: 'en' | 'es'
) {
  const variants = await listActiveOutreachVariants().catch(() => [])
  if (!variants.length) return null

  const candidates = [
    { segmentType: 'best_offer', segmentKey: String(lead.best_offer || '') },
    { segmentType: 'language', segmentKey: String(lead.language_segment || '') },
    { segmentType: 'category', segmentKey: String(lead.category || '') },
    { segmentType: 'niche', segmentKey: String(lead.niche || '') },
    { segmentType: 'city_state', segmentKey: [lead.city, lead.state].filter(Boolean).join('|') },
  ]

  for (const candidate of candidates) {
    if (!candidate.segmentKey) continue
    const match = variants.find(
      (variant) =>
        variant.channel === channel &&
        variant.language === language &&
        variant.segment_type === candidate.segmentType &&
        variant.segment_key.toLowerCase() === candidate.segmentKey.toLowerCase()
    )
    if (match) return match
  }

  return null
}

async function templateOutreach(lead: LeadRecord, score?: LeadScoreRecord | null): Promise<GeneratedOutreachBundle> {
  const business = lead.business_name || lead.name || 'there'
  const city = [lead.city, lead.state].filter(Boolean).join(', ')
  const offer = lead.best_offer || score?.best_offer || 'VestBlock support'
  const publicOffer = publicOfferLabel(lead, typeof offer === 'string' ? offer : String(offer))
  const language = leadLanguage(lead)
  const variantEmail = await pickVariantGuidance(lead, 'email', language)
  const variantSms = await pickVariantGuidance(lead, 'sms', language)
  const variantFacebook = await pickVariantGuidance(lead, 'facebook_dm', language)
  const variantInstagram = await pickVariantGuidance(lead, 'instagram_dm', language)
  const variantPhone = await pickVariantGuidance(lead, 'phone_script', language)
  const cta =
    variantEmail?.cta ||
    variantSms?.cta ||
    variantFacebook?.cta ||
    variantInstagram?.cta ||
    variantPhone?.cta ||
    leadCta(lead)
  const realEstateStrategy = String(lead.metadata_json?.realEstateStrategy || lead.form_data?.realEstateStrategy || '').toLowerCase()
  const reason =
    lead.pain_signal ||
    (lead.category === 'code_violation'
      ? 'public property-compliance activity that may point to seller motivation'
      : lead.category === 'seller_lead' || lead.category === 'real_estate' || lead.lead_type === 'sell_house' || lead.lead_type === 'real_estate'
        ? 'property ownership details that suggest a possible sale or investor conversation'
        : lead.category === 'new_business_formation'
          ? 'a newly formed business profile'
          : 'growth and funding readiness signals')
  const realEstateOfferText =
    language === 'es'
      ? 'conversaciones de venta directa, revision de inversionista y opciones practicas para vender la propiedad'
      : 'direct-sale conversations, investor review, and practical seller options'
  const realEstateSupportText =
    language === 'es'
      ? 'VestBlock puede ayudar a evaluar una venta directa, una conversacion con inversionista o el mejor siguiente paso si quieres salir de la propiedad.'
      : 'VestBlock can help evaluate a direct sale, an investor conversation, or the strongest next step if you want to move the property.'
  const strategySpecificOfferText =
    realEstateStrategy === 'fast_cash'
      ? language === 'es'
        ? 'una conversacion simple de venta rapida y as-is'
        : 'a simple fast-cash, as-is sale conversation'
      : realEstateStrategy === 'failed_listing'
        ? language === 'es'
          ? 'una comparacion de nuevas opciones despues de una venta fallida'
          : 'a new-options comparison after a failed listing'
      : realEstateStrategy === 'novation'
        ? language === 'es'
          ? 'una comparacion entre novacion y venta directa'
          : 'a novation-versus-direct-sale comparison'
        : realEstateStrategy === 'creative_finance'
          ? language === 'es'
            ? 'una conversacion sobre terminos flexibles y salida creativa'
            : 'a flexible-terms and creative-exit conversation'
          : realEstateOfferText
  const strategySpecificSupportText =
    realEstateStrategy === 'fast_cash'
      ? language === 'es'
        ? 'Si la prioridad es velocidad, condicion as-is, o menos friccion, VestBlock puede ayudarte a revisar una salida rapida y una conversacion realista con comprador.'
        : 'If the priority is speed, as-is condition, or less friction, VestBlock can help review a fast-exit path and a realistic buyer conversation.'
      : realEstateStrategy === 'failed_listing'
        ? language === 'es'
          ? 'Si la propiedad ya paso por el mercado sin venderse, VestBlock puede ayudarte a comparar una ruta diferente en vez de seguir haciendo lo mismo.'
          : 'If the property already went through the market without selling, VestBlock can help compare a different path instead of repeating the same approach.'
      : realEstateStrategy === 'novation'
        ? language === 'es'
          ? 'Si la propiedad parece mas limpia que una venta cash tipica, VestBlock puede ayudarte a comparar una ruta tipo novacion con una venta directa mas sencilla.'
          : 'If the property looks cleaner than a typical cash-offer deal, VestBlock can help compare a novation-style path with a simpler direct sale.'
        : realEstateStrategy === 'creative_finance'
          ? language === 'es'
            ? 'Si hay apertura a terminos, tiempo, o flexibilidad, VestBlock puede ayudarte a revisar una conversacion de seller finance, subject-to, u otras opciones creativas.'
            : 'If there is openness to terms, timing, or flexibility, VestBlock can help review a seller-finance, subject-to, or other creative-exit conversation.'
          : realEstateSupportText

  if (language === 'es') {
    return {
      sms: {
        body: truncate(
          `Hola ${business}, ${variantSms?.opener || `vi ${reason} en ${city || 'tu mercado'}`}. VestBlock ayuda con ${publicOffer} y los siguientes pasos. ${cta}`,
          300
        ),
        complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.sms,
        cta,
        language,
      },
      email: {
        subject: isSellerAcquisitionLead(lead)
          ? `${business}: opciones practicas para esta propiedad`
          : `${business}: una oportunidad practica para ${publicOffer}`,
        body: `Hola ${business},\n\n${variantEmail?.opener || `Vi ${reason}${city ? ` en ${city}` : ''} y pensé que VestBlock podría ayudarte.`} ${
          variantEmail?.body_guidance ||
          (isSellerAcquisitionLead(lead)
            ? strategySpecificSupportText
            : 'Ayudamos a negocios a ordenar acuerdos, mejorar captura de leads y tomar mejores siguientes pasos sin inflar promesas.')
        } ${fundingBridgeLine(lead, language)}\n\nSegún lo que encontramos, la mejor conversación inicial parece ser: ${
          isSellerAcquisitionLead(lead) ? strategySpecificOfferText : publicOffer
        }.\n\n${cta}\n\nSaludos,\n${OUTREACH_SIGNATURE}`,
        complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.email,
        cta,
        language,
      },
      facebook_dm: {
        body: `Hola ${business}, ${variantFacebook?.opener || `vi ${reason}${city ? ` en ${city}` : ''}`}. VestBlock ayuda con ${publicOffer} y automatizacion util. ${cta}`,
        complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.facebook_dm,
        cta,
        language,
      },
      instagram_dm: {
        body: `Hola ${business}, ${variantInstagram?.opener || `note ${reason}${city ? ` en ${city}` : ''}`}. Podemos ayudarte con ${publicOffer}. ${cta}`,
        complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.facebook_dm,
        cta,
        language,
      },
      phone_script: {
        body: `Hola, habla VestBlock. ${variantPhone?.opener || `Vimos ${reason}${city ? ` en ${city}` : ''}` } y queriamos saber si estas abierto a una llamada breve sobre ${publicOffer}. ${cta}`,
        complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.phone_script,
        cta,
        language,
      },
      generatedWith: 'template',
    }
  }

  return {
    sms: {
      body: truncate(
        `Hi ${business}, ${variantSms?.opener || `I came across ${reason} in ${city || 'your market'}`}. VestBlock helps owners with ${publicOffer} and next-step readiness. ${cta}`,
        300
      ),
      complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.sms,
      cta,
      language,
    },
    email: {
      subject: isSellerAcquisitionLead(lead)
        ? realEstateStrategy === 'fast_cash'
          ? `${business}: a simple as-is cash path for this property`
          : realEstateStrategy === 'failed_listing'
            ? `${business}: a different path after the listing stalled`
          : realEstateStrategy === 'novation'
            ? `${business}: novation vs direct sale for this property`
            : realEstateStrategy === 'creative_finance'
              ? `${business}: flexible options for this property`
              : `${business}: practical options for this property`
        : `${business}: a practical next step for ${publicOffer}`,
      body: `Hi ${business},\n\n${variantEmail?.opener || `I came across ${reason}${city ? ` in ${city}` : ''} and thought VestBlock might be useful.`} ${
        variantEmail?.body_guidance ||
        (isSellerAcquisitionLead(lead)
          ? strategySpecificSupportText
          : 'We help businesses track agreements, improve lead capture, and choose cleaner next steps without overpromising.')
      } ${fundingBridgeLine(lead, language)}\n\nBased on what we found, the best next conversation looks like: ${
        isSellerAcquisitionLead(lead) ? strategySpecificOfferText : publicOffer
      }.\n\n${cta}\n\nBest,\n${OUTREACH_SIGNATURE}`,
      complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.email,
      cta,
      language,
    },
    facebook_dm: {
      body: `Hi ${business} — ${variantFacebook?.opener || `I found ${reason}${city ? ` in ${city}` : ''} and thought you might want a quick outside read.`} VestBlock helps with ${
        isSellerAcquisitionLead(lead) ? 'direct-sale and investor option reviews' : `${publicOffer} and the systems around it`
      }. ${cta}`,
      complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.facebook_dm,
      cta,
      language,
    },
    instagram_dm: {
      body: `Hi ${business} — ${variantInstagram?.opener || `I found ${reason}${city ? ` in ${city}` : ''}.`} ${
        isSellerAcquisitionLead(lead)
          ? `We help owners think through direct-sale and investor options. ${cta}`
          : `We help with ${publicOffer} and automation that closes more leads. ${cta}`
      }`,
      complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.facebook_dm,
      cta,
      language,
    },
    phone_script: {
      body: `Hi, this is VestBlock. ${variantPhone?.opener || `We came across ${reason}${city ? ` in ${city}` : ''}`} and wanted to see if you are open to a short conversation about ${
        isSellerAcquisitionLead(lead) ? 'direct-sale or investor options for the property' : publicOffer
      }. We focus on practical next steps, not inflated promises. ${cta}`,
      complianceNote: OUTREACH_UNSUBSCRIBE_NOTES.phone_script,
      cta,
      language,
    },
    generatedWith: 'template',
  }
}

export async function generateLeadOutreach(
  lead: LeadRecord,
  score?: LeadScoreRecord | null
): Promise<GeneratedOutreachBundle> {
  if (isSellerAcquisitionLead(lead)) {
    return templateOutreach(lead, score)
  }

  if (!process.env.OPENAI_API_KEY) {
    return templateOutreach(lead, score)
  }

  const emailVariant = await pickVariantGuidance(lead, 'email', leadLanguage(lead))
  const baseTemplate = await templateOutreach(lead, score)

  const messages = [
    {
      role: 'system' as const,
      content:
        'You create concise compliant outreach for B2B lead generation. Never promise approvals, outcomes, or guaranteed savings. Return JSON with keys sms,email,facebook_dm,instagram_dm,phone_script. Each key must contain body, cta, language, complianceNote. Email must also contain subject.',
    },
    {
      role: 'user' as const,
      content: JSON.stringify({
        lead: {
          name: lead.name,
          business_name: lead.business_name,
          city: lead.city,
          state: lead.state,
          category: lead.category,
          language_signal: lead.language_signal,
          language_segment: lead.language_segment,
          pain_signal: lead.pain_signal,
          best_offer: lead.best_offer || score?.best_offer,
          website: lead.website,
          lead_score: lead.lead_score || score?.score,
          outreach_angle: lead.outreach_angle,
          market_segment: lead.market_segment,
        },
        instructions: {
          tone: 'direct, premium, useful',
          channels: ['sms', 'email', 'facebook_dm', 'instagram_dm', 'phone_script'],
          includeUnsubscribe: true,
          language: leadLanguage(lead),
          mentionFundingReadinessWhenHelpful: shouldMentionFundingBridge(lead),
          activeVariantGuidance: emailVariant
            ? {
                segmentType: emailVariant.segment_type,
                segmentKey: emailVariant.segment_key,
                opener: emailVariant.opener,
                bodyGuidance: emailVariant.body_guidance,
                cta: emailVariant.cta,
              }
            : null,
        },
      }),
    },
  ]

  try {
    const completion = await createChatCompletion(messages, false, {
      model: 'gpt-4o-mini',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      max_tokens: 900,
      timeout: 30000,
    })

    const raw = completion.choices?.[0]?.message?.content
    if (!raw) {
      return baseTemplate
    }

    const parsed = JSON.parse(raw)
    const bundle: GeneratedOutreachBundle = {
      sms: {
        body: parsed.sms?.body || baseTemplate.sms.body,
        cta: parsed.sms?.cta || baseTemplate.sms.cta,
        language: parsed.sms?.language || baseTemplate.sms.language,
        complianceNote:
          parsed.sms?.complianceNote || OUTREACH_UNSUBSCRIBE_NOTES.sms,
      },
      email: {
        subject:
          parsed.email?.subject ||
          baseTemplate.email.subject,
        body: parsed.email?.body || baseTemplate.email.body,
        cta: parsed.email?.cta || baseTemplate.email.cta,
        language: parsed.email?.language || baseTemplate.email.language,
        complianceNote:
          parsed.email?.complianceNote || OUTREACH_UNSUBSCRIBE_NOTES.email,
      },
      facebook_dm: {
        body:
          parsed.facebook_dm?.body ||
          baseTemplate.facebook_dm.body,
        cta:
          parsed.facebook_dm?.cta ||
          baseTemplate.facebook_dm.cta,
        language:
          parsed.facebook_dm?.language ||
          baseTemplate.facebook_dm.language,
        complianceNote:
          parsed.facebook_dm?.complianceNote ||
          OUTREACH_UNSUBSCRIBE_NOTES.facebook_dm,
      },
      instagram_dm: {
        body:
          parsed.instagram_dm?.body ||
          baseTemplate.instagram_dm.body,
        cta:
          parsed.instagram_dm?.cta ||
          baseTemplate.instagram_dm.cta,
        language:
          parsed.instagram_dm?.language ||
          baseTemplate.instagram_dm.language,
        complianceNote:
          parsed.instagram_dm?.complianceNote ||
          OUTREACH_UNSUBSCRIBE_NOTES.facebook_dm,
      },
      phone_script: {
        body:
          parsed.phone_script?.body ||
          baseTemplate.phone_script.body,
        cta:
          parsed.phone_script?.cta ||
          baseTemplate.phone_script.cta,
        language:
          parsed.phone_script?.language ||
          baseTemplate.phone_script.language,
        complianceNote:
          parsed.phone_script?.complianceNote ||
          OUTREACH_UNSUBSCRIBE_NOTES.phone_script,
      },
      generatedWith: 'openai',
    }

    bundle.email.body = ensureFundingBridgeInEmailBody(bundle.email.body, lead, leadLanguage(lead))

    return bundle
  } catch {
    return baseTemplate
  }
}

export function channelLabel(channel: OutreachChannel) {
  switch (channel) {
    case 'sms':
      return 'SMS'
    case 'email':
      return 'Email'
    case 'facebook_dm':
      return 'Facebook / DM'
    case 'phone_script':
      return 'Phone script'
    case 'instagram_dm':
      return 'Instagram DM'
  }
}
