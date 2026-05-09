// lib/letters/ai.ts
import { getOpenAIClient } from '@/lib/openai-server';

type NegativeItem = {
  creditor?: string;
  account_type?: string;
  account_last4?: string;
  bureaus: string[];
  reason?: string;
};

const STYLE_ROTATION = [
  'formal & concise',
  'firm & assertive',
  'polite but insistent',
  'regulatory-citation focused',
  'time-boxed, action-oriented',
] as const;

export async function generateLetterBodyHTML(opts: {
  fullName: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  bureau: 'Experian' | 'Equifax' | 'TransUnion';
  letterType:
    | '609'
    | 'Debt Validation'
    | 'Incorrect Information'
    | 'Cease & Desist'
    | 'Direct Furnisher Dispute'
    | 'Method Of Verification'
    | 'Statement Of Dispute'
    | 'Identity Theft Block'
    | 'Mixed File'
    | 'Outdated Information'
    | 'Personal Information Correction';
  items: NegativeItem[];
  dateISO: string;
  version: number; // used to rotate style
  previousHtml?: string; // used to avoid near-duplicates
}) {
  const {
    fullName,
    bureau,
    letterType,
    items,
    dateISO,
    version,
    previousHtml,
  } = opts;

  // rotate tone; each regenerate picks the next style
  const tone = STYLE_ROTATION[version % STYLE_ROTATION.length];

  // nudge the model for variation (temperature/top_p control randomness)
  // temperature↑ => more diverse; top_p ~ nucleus sampling.
  const temperature = 0.85; // varied but still safe
  const top_p = 0.9;

  // seed is for reproducibility (use different seed to encourage change)
  const seed = Date.now(); // different on each regenerate

  // Build a compact, deterministic summary of items
  const bullets = items
    .slice(0, 10)
    .map((it, i) => {
      const name = it.creditor || it.account_type || 'Account';
      const last4 = it.account_last4 ? ` ****${it.account_last4}` : '';
      const reason = it.reason ? ` — ${it.reason}` : '';
      return `${i + 1}. ${name}${last4}${reason}`;
    })
    .join('\n');

  const sys = [
    'You draft US credit dispute letters.',
    'Return ONLY valid HTML fragments (<p>,<ol>,<ul>,<li>,<strong>,<em>,<br/>,<h1>-<h4>) without <html> or <body>.',
    'Avoid boilerplate repetition across drafts; vary phrasing and structure.',
  ].join(' ');

  const user = `
Context:
- Date: ${dateISO}
- Consumer: ${fullName}, 
- Bureau: ${bureau}
- Letter Type: ${letterType}
- Tone/style: ${tone}
- Negative items (max 10 shown):
${bullets || '(none)'}
- Previous HTML hash present: ${previousHtml ? 'yes' : 'no'}

Task:
Compose a fresh dispute letter body in HTML (no outer <html>), tailored to ${bureau} and ${letterType}.
Include a short opening, a bulleted/numbered list referencing the items, and a clear, time-bound request.
Reference FCRA/FDCPA where relevant, and keep claims factual and reviewable.
If the type is "Statement Of Dispute", make it clear that the consumer is asking for a dispute notation if the issue remains unresolved.
If the type is "Identity Theft Block", frame the request around unauthorized activity, supporting documentation, and blocking/removing fraudulent reporting where appropriate.
If the type is "Mixed File" or "Personal Information Correction", focus on incorrect identifiers, merged data, and separating the consumer's file from unrelated information.
If the type is "Outdated Information", focus on dates, reporting period review, and removal of information that should no longer appear.
Do not include a physical signature block or consumer address (header handled elsewhere).
Vary phrasing from any prior draft; avoid exact sentences used before.
`;

  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error('OpenAI client is not configured.');
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // or your preferred model
    temperature,
    top_p,
    seed,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
  });

  const html = completion.choices?.[0]?.message?.content?.trim() || '';
  return html;
}
