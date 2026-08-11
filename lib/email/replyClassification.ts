export const REPLY_CLASSIFICATIONS = [
  'positive_interested',
  'requesting_more_information',
  'price_terms_provided',
  'call_requested',
  'not_now',
  'follow_up_later',
  'not_interested',
  'wrong_person',
  'property_sold',
  'already_funded',
  'unsubscribe',
  'auto_reply',
  'bounce',
  'spam_irrelevant',
  'needs_human_review',
] as const;

export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];
export type SequenceAction = 'stop' | 'pause' | 'continue';
export type ReplyPriority = 'urgent' | 'high' | 'normal' | 'low';

export type ReplyDecision = {
  classification: ReplyClassification;
  confidence: number;
  reasons: string[];
  sequenceAction: SequenceAction;
  globalSuppress: boolean;
  createTask: boolean;
  priority: ReplyPriority;
  leadStatus: string | null;
  outreachStatus: string | null;
  nextStep: string;
};

type ClassifyReplyInput = {
  fromEmail?: string | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  classificationOverride?: ReplyClassification | null;
};

type Rule = {
  classification: ReplyClassification;
  pattern: RegExp;
  confidence: number;
  reason: string;
};

const RULES: Rule[] = [
  {
    classification: 'bounce',
    pattern:
      /(?:delivery[\s-]+(?:status notification|failed|failure)|undeliver(?:ed|able)|address not found|mailbox (?:is )?(?:full|unavailable)|message (?:was )?blocked|recipient rejected|permanent failure|returned mail|550 5\.[0-9]\.[0-9])/i,
    confidence: 0.99,
    reason: 'Delivery-failure language was detected.',
  },
  {
    classification: 'auto_reply',
    pattern:
      /(?:automatic reply|auto(?:matic)?[\s-]+response|out of (?:the )?office|away from (?:my|the) office|vacation responder|currently unavailable|i will (?:be back|return))/i,
    confidence: 0.97,
    reason: 'Automatic-reply or out-of-office language was detected.',
  },
  {
    classification: 'wrong_person',
    pattern:
      /(?:wrong (?:person|owner|email|number)|not (?:the )?owner|never owned|do not own|doesn['’]?t belong to me|you have the wrong)/i,
    confidence: 0.97,
    reason: 'The sender says the contact or ownership match is wrong.',
  },
  {
    classification: 'property_sold',
    pattern:
      /(?:property|house|building|parcel|land).{0,35}(?:already |has been |was )?sold|(?:already |has been |was )sold.{0,35}(?:property|house|building|parcel|land)/i,
    confidence: 0.95,
    reason: 'The sender says the referenced property has been sold.',
  },
  {
    classification: 'already_funded',
    pattern:
      /(?:already (?:got|received|secured|found) (?:the )?(?:funding|financing|loan)|funding (?:is )?(?:handled|complete|secured)|financing (?:is )?(?:handled|complete|secured)|no longer need (?:funding|financing|a loan))/i,
    confidence: 0.95,
    reason: 'The sender says the funding need has already been resolved.',
  },
  {
    classification: 'not_interested',
    pattern:
      /(?:not interested|no interest|please don['’]?t follow up|don['’]?t contact me about this|not looking (?:to|for)|we(?:'re| are) not interested|i(?:'m| am) going to pass|no thanks|not for me)/i,
    confidence: 0.96,
    reason: 'The sender explicitly declined the offer or conversation.',
  },
  {
    classification: 'not_now',
    pattern:
      /(?:not (?:right )?now|bad time|timing isn['’]?t right|not ready yet|maybe later|check back (?:later|another time)|circle back (?:later|another time))/i,
    confidence: 0.91,
    reason: 'The sender declined for now without closing the door.',
  },
  {
    classification: 'follow_up_later',
    pattern:
      /(?:follow up|reach (?:back )?out|contact me|call me|email me|check back).{0,35}(?:next (?:week|month|quarter|year)|in \d+ (?:days?|weeks?|months?)|after |on \w+|later)|(?:next (?:week|month|quarter)|in \d+ (?:days?|weeks?|months?)).{0,35}(?:follow up|reach out|contact|call|email)/i,
    confidence: 0.93,
    reason: 'The sender asked for contact at a later time.',
  },
  {
    classification: 'call_requested',
    pattern:
      /(?:call me|give me a call|can (?:you|we) (?:call|talk|speak)|let['’]?s (?:talk|speak|schedule|connect)|schedule (?:a )?(?:call|time)|what time (?:can|could) (?:you|we) (?:call|talk))/i,
    confidence: 0.94,
    reason: 'The sender requested a call or conversation.',
  },
  {
    classification: 'price_terms_provided',
    pattern:
      /(?:asking|price|offer|terms|rate|points|down payment|purchase price|payoff|monthly payment|interest rate).{0,30}(?:\$[\d,.]+|\d+(?:\.\d+)?%|\d[\d,]{3,})|(?:\$[\d,.]+|\d+(?:\.\d+)?%).{0,30}(?:asking|price|offer|terms|rate|points|payment)/i,
    confidence: 0.93,
    reason: 'The reply appears to include price or financing terms.',
  },
  {
    classification: 'requesting_more_information',
    pattern:
      /(?:send (?:me )?(?:more |the )?(?:info|information|details)|more (?:info|information|details)|tell me more|how does (?:it|this) work|what (?:are|is|do|does|did|would|can)|can you (?:explain|share|send|provide)|please (?:explain|share|send|provide))/i,
    confidence: 0.9,
    reason: 'The sender asked for information or clarification.',
  },
  {
    classification: 'positive_interested',
    pattern:
      /(?:i(?:'m| am) interested|we(?:'re| are) interested|sounds (?:good|interesting)|interested in (?:learning|hearing|discussing|selling|buying|funding)|yes[,!. ]|i['’]?d like to|let['’]?s move forward|open to (?:an offer|talking|discussing)|happy to (?:talk|discuss|connect))/i,
    confidence: 0.92,
    reason: 'The sender expressed direct interest or willingness to continue.',
  },
  {
    classification: 'spam_irrelevant',
    pattern:
      /(?:guest post|link insertion|seo package|crypto investment|casino|adult traffic|buy followers|telegram investment|website redesign offer|rank (?:you|your site) on google)/i,
    confidence: 0.88,
    reason: 'The content matches common unrelated solicitation language.',
  },
];

const EXPLICIT_STOP_PATTERN =
  /(?:^|\b)(?:unsubscribe|stop(?:\s+(?:emailing|contacting|messaging|sending))?|remove me|take me off|do not (?:contact|email|message|text)|don['’]?t (?:contact|email|message|text)|opt[\s-]?out|no more emails)(?:\b|$)/i;

const BOUNCE_SENDER_PATTERN =
  /(?:mailer-daemon|postmaster|mail delivery subsystem|no-reply@.*(?:mail|delivery))/i;

export function plainTextFromReply(input: Pick<ClassifyReplyInput, 'text' | 'html'>) {
  const source = input.text || input.html || '';
  return String(source)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function decision(
  classification: ReplyClassification,
  confidence: number,
  reasons: string[]
): ReplyDecision {
  const policy: Record<
    ReplyClassification,
    Omit<ReplyDecision, 'classification' | 'confidence' | 'reasons'>
  > = {
    positive_interested: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: true,
      priority: 'urgent',
      leadStatus: 'contacted',
      outreachStatus: null,
      nextStep: 'Review context and send a human-approved response.',
    },
    requesting_more_information: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: true,
      priority: 'high',
      leadStatus: 'contacted',
      outreachStatus: null,
      nextStep: 'Review the request and approve a factual reply.',
    },
    price_terms_provided: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: true,
      priority: 'urgent',
      leadStatus: 'contacted',
      outreachStatus: null,
      nextStep: 'Review the terms; do not negotiate automatically.',
    },
    call_requested: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: true,
      priority: 'urgent',
      leadStatus: 'contacted',
      outreachStatus: null,
      nextStep: 'Schedule or make the requested call.',
    },
    not_now: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: false,
      priority: 'normal',
      leadStatus: 'contacted',
      outreachStatus: null,
      nextStep: 'Move the contact to a light nurture follow-up.',
    },
    follow_up_later: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: true,
      priority: 'normal',
      leadStatus: 'contacted',
      outreachStatus: null,
      nextStep: 'Set a human-reviewed follow-up date from the reply.',
    },
    not_interested: {
      sequenceAction: 'stop',
      globalSuppress: false,
      createTask: false,
      priority: 'low',
      leadStatus: 'disqualified',
      outreachStatus: 'do_not_contact',
      nextStep: 'End this campaign and retain the outcome for reporting.',
    },
    wrong_person: {
      sequenceAction: 'stop',
      globalSuppress: true,
      createTask: false,
      priority: 'normal',
      leadStatus: 'do_not_contact',
      outreachStatus: 'do_not_contact',
      nextStep: 'Suppress this address and review the underlying contact match.',
    },
    property_sold: {
      sequenceAction: 'stop',
      globalSuppress: false,
      createTask: false,
      priority: 'normal',
      leadStatus: 'disqualified',
      outreachStatus: 'do_not_contact',
      nextStep: 'Close the property campaign and record the sold outcome.',
    },
    already_funded: {
      sequenceAction: 'stop',
      globalSuppress: false,
      createTask: false,
      priority: 'normal',
      leadStatus: 'disqualified',
      outreachStatus: 'do_not_contact',
      nextStep: 'Close the funding campaign and retain the outcome.',
    },
    unsubscribe: {
      sequenceAction: 'stop',
      globalSuppress: true,
      createTask: false,
      priority: 'urgent',
      leadStatus: 'do_not_contact',
      outreachStatus: 'do_not_contact',
      nextStep: 'Suppress promotional outreach globally. No sales follow-up.',
    },
    auto_reply: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: false,
      priority: 'low',
      leadStatus: null,
      outreachStatus: null,
      nextStep: 'Pause the sequence and review the return timing before resuming.',
    },
    bounce: {
      sequenceAction: 'stop',
      globalSuppress: true,
      createTask: false,
      priority: 'high',
      leadStatus: 'disqualified',
      outreachStatus: 'do_not_contact',
      nextStep: 'Suppress the address and repair contact data before any retry.',
    },
    spam_irrelevant: {
      sequenceAction: 'stop',
      globalSuppress: false,
      createTask: false,
      priority: 'low',
      leadStatus: null,
      outreachStatus: null,
      nextStep: 'Ignore the unrelated message and keep it out of the hot queue.',
    },
    needs_human_review: {
      sequenceAction: 'pause',
      globalSuppress: false,
      createTask: true,
      priority: 'high',
      leadStatus: 'contacted',
      outreachStatus: null,
      nextStep: 'Review the reply before any further automated contact.',
    },
  };

  return { classification, confidence, reasons, ...policy[classification] };
}

export function classifyReply(input: ClassifyReplyInput): ReplyDecision {
  const body = plainTextFromReply(input);
  const subject = String(input.subject || '').trim();
  const fromEmail = String(input.fromEmail || '').trim();
  const combined = `${subject}\n${body}`.trim();

  // Consent intent always wins, including over a manual/LLM classification hint.
  if (EXPLICIT_STOP_PATTERN.test(combined)) {
    return decision('unsubscribe', 1, [
      'Explicit stop, opt-out, or unsubscribe language was detected.',
      'Consent rules take precedence over every other classification.',
    ]);
  }

  if (BOUNCE_SENDER_PATTERN.test(fromEmail)) {
    return decision('bounce', 0.99, [
      'The sender address is a mail delivery agent or postmaster.',
    ]);
  }

  if (input.classificationOverride) {
    return decision(input.classificationOverride, 1, [
      'A human operator supplied this classification.',
    ]);
  }

  if (
    /(?:i(?:'m| am) interested|we(?:'re| are) interested|i['’]?d like to|let['’]?s move forward)/i.test(
      combined
    ) &&
    /(?:send (?:me )?(?:more |the )?(?:info|information|details)|more (?:info|information|details)|tell me more)/i.test(
      combined
    )
  ) {
    return decision('positive_interested', 0.97, [
      'The sender expressed interest and asked to continue the conversation.',
    ]);
  }

  for (const rule of RULES) {
    if (rule.pattern.test(combined)) {
      return decision(rule.classification, rule.confidence, [rule.reason]);
    }
  }

  return decision('needs_human_review', 0.45, [
    combined
      ? 'No deterministic rule was strong enough to classify the reply safely.'
      : 'The message body is empty or unavailable.',
  ]);
}

export function summarizeReply(input: Pick<ClassifyReplyInput, 'text' | 'html'>) {
  const plain = plainTextFromReply(input);
  if (!plain) return 'Reply received with no readable text body.';
  return plain.length <= 280 ? plain : `${plain.slice(0, 277).trimEnd()}...`;
}

export function suggestedReplyFor(
  classification: ReplyClassification,
  context: { firstName?: string | null; propertyAddress?: string | null } = {}
) {
  const greeting = context.firstName ? `Hi ${context.firstName},` : 'Hi,';
  const property = context.propertyAddress
    ? ` regarding ${context.propertyAddress}`
    : '';

  switch (classification) {
    case 'positive_interested':
      return `${greeting}\n\nThanks for getting back to me${property}. I can send the relevant details and answer your questions. What would be most useful to review first?\n\nBest,\nVestBlock`;
    case 'requesting_more_information':
      return `${greeting}\n\nThanks for your reply${property}. I’m reviewing the context now so I can send accurate, relevant details. I’ll keep the response concise and avoid making assumptions.\n\nBest,\nVestBlock`;
    case 'call_requested':
      return `${greeting}\n\nHappy to connect${property}. Please send the best number and a couple of times that work for you, including your time zone.\n\nBest,\nVestBlock`;
    case 'price_terms_provided':
      return `${greeting}\n\nThank you for sharing those terms${property}. We’ll review them and respond after confirming the details. This note is only an acknowledgement, not an acceptance or counteroffer.\n\nBest,\nVestBlock`;
    case 'not_now':
    case 'follow_up_later':
      return `${greeting}\n\nUnderstood. We’ll pause the current outreach and follow up only at an appropriate time.\n\nBest,\nVestBlock`;
    case 'unsubscribe':
      return `${greeting}\n\nUnderstood. We’ve recorded your request and will stop promotional outreach to this address.\n\nVestBlock`;
    case 'wrong_person':
      return `${greeting}\n\nThank you for letting us know. We’ll correct our records and stop outreach to this address.\n\nVestBlock`;
    case 'not_interested':
      return `${greeting}\n\nUnderstood. We’ll close this outreach thread. Thank you for the response.\n\nVestBlock`;
    default:
      return null;
  }
}
