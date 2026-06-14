import type { InvestorProfileRecord, InvestorSequenceCode } from '@/lib/investors/types'
import { builderBuyBoxQuestions, builderOutreachAngle, isBuilderPartnerLike } from '@/lib/investors/builderStrategy'

export const INVESTOR_OUTREACH_SEQUENCES: Record<
  InvestorSequenceCode,
  { name: string; subject: string; body: string; cta: string }
> = {
  A: {
    name: 'Deal Flow',
    subject: 'Off-market deal flow in your market',
    body: 'VestBlock helps investors acquire off-market opportunities that fit their buy box. We are building strategic partnerships with active buyers in your market and would like to learn more about what you’re currently acquiring.',
    cta: 'Can you send over your current buy box?',
  },
  B: {
    name: 'Disposition Support',
    subject: 'Buyer network support for your inventory',
    body: 'VestBlock works with investors and operators who need help moving inventory, finding buyers, and increasing disposition velocity. We may be able to help place properties with our growing investor network.',
    cta: 'Do you have any properties or assignments that need more buyer coverage?',
  },
  C: {
    name: 'Financing Support',
    subject: 'Capital options for acquisitions and projects',
    body: 'VestBlock has lending relationships that can assist with fix-and-flip projects, rental acquisitions, DSCR opportunities, business funding, and working capital needs. We are interested in understanding your current financing requirements.',
    cta: 'What types of funding are you currently looking for?',
  },
  D: {
    name: 'Strategic Partnership',
    subject: 'Strategic investor partnership with VestBlock',
    body: 'VestBlock is creating a deal-routing network that connects investors, wholesalers, lenders, acquisition teams, and disposition teams. We are seeking long-term partners who want more deal flow, more buyers, and more capital solutions.',
    cta: 'Would it make sense to compare partnership criteria this week?',
  },
}

export function buildInvestorOutreachMessage(investor: InvestorProfileRecord, sequenceCode = investor.assigned_sequence) {
  const isBuilderPartner = isBuilderPartnerLike({
    displayName: investor.display_name,
    primaryInvestorType: investor.primary_investor_type,
    classificationTags: investor.classification_tags,
    notes: investor.notes,
    metadata: investor.metadata_json,
  })
  const sequence = INVESTOR_OUTREACH_SEQUENCES[sequenceCode]
  const name = investor.person_name || investor.company_name || investor.llc_name || investor.display_name
  const marketLine = investor.markets?.length ? ` I noticed activity tied to ${investor.markets.slice(0, 3).join(', ')}.` : ''
  const intro = name ? `Hi ${name.split(' ')[0]},\n\n` : 'Hi,\n\n'

  if (isBuilderPartner) {
    const angle = builderOutreachAngle(investor.markets || [])
    const questions = builderBuyBoxQuestions(investor.markets?.[0] || null)

    return {
      sequenceCode,
      subject: angle.subject,
      body:
        `${intro}` +
        `I’m reaching out from VestBlock. We are building a builder and construction partner lane so distressed, teardown, infill, and heavy-rehab opportunities can be routed to groups that actually know what they can build or renovate.${marketLine}\n\n` +
        `Rather than send random properties, we want your real criteria first. The most useful things for us to understand are:\n` +
        questions.map((question) => `- ${question}`).join('\n') +
        `\n\nIf your team already has a buy box, build sheet, or neighborhoods list, send it over and we will align to it.\n\nBest,\nVestBlock Partnerships`,
      cta: angle.cta,
    }
  }

  return {
    sequenceCode,
    subject: sequence.subject,
    body: `${intro}${sequence.body}${marketLine}\n\n${sequence.cta}\n\nBest,\nVestBlock Partnerships`,
    cta: sequence.cta,
  }
}

export function inferFollowUpTasks(message: string) {
  const normalized = message.toLowerCase()
  const tasks: Array<{ taskType: string; assignedTeam: string; prompt: string }> = []

  if (/buy box|criteria|zip|price|arv|beds|asset/.test(normalized)) {
    tasks.push({
      taskType: 'collect_buy_box',
      assignedTeam: 'acquisitions',
      prompt: 'Collect markets, property types, price range, ARV range, rehab tolerance, close speed, and proof-of-funds status.',
    })
  }

  if (/loan|lend|fund|capital|dscr|bridge|hard money|working capital/.test(normalized)) {
    tasks.push({
      taskType: 'collect_lending_requirements',
      assignedTeam: 'lending',
      prompt: 'Collect loan purpose, amount, property address if available, credit profile, timeline, collateral, DSCR or rehab details, and required close date.',
    })
  }

  if (/sell|dispo|assignment|inventory|buyer|move/.test(normalized)) {
    tasks.push({
      taskType: 'collect_disposition_requirements',
      assignedTeam: 'dispositions',
      prompt: 'Collect property address, asking price, assignment terms, access details, photos, condition, deadline, and desired buyer profile.',
    })
  }

  if (/builder|build|construction|developer|development|infill|teardown|lot|spec home|ground up|rehab budget/.test(normalized)) {
    tasks.push({
      taskType: 'collect_builder_buy_box',
      assignedTeam: 'acquisitions',
      prompt:
        'Collect builder neighborhoods, project type, lot or square-foot minimums, rehab tolerance, build budget range, close speed, and hard no-go items.',
    })
  }

  if (/yes|interested|send deal|send property|send contract|assignment|paper it|move forward|next step/.test(normalized)) {
    tasks.push({
      taskType: 'assignment_contract_prep',
      assignedTeam: 'dispositions',
      prompt:
        'Prepare the assignment packet: confirm purchase price, assignment fee, assignee entity, earnest money, close window, inspection terms, and supporting property packet.',
    })
  }

  if (/call|meet|calendar|schedule|book/.test(normalized)) {
    tasks.push({
      taskType: 'book_call',
      assignedTeam: 'partnerships',
      prompt: 'Book an investor partnership call and attach any buy box, lending, or disposition notes before the meeting.',
    })
  }

  return tasks.length
    ? tasks
    : [
        {
          taskType: 'manual_review',
          assignedTeam: 'partnerships',
          prompt: 'Review the reply and decide whether to route this investor toward deals, dispositions, lending, or a strategic partnership.',
        },
      ]
}
