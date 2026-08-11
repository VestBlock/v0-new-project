#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import {
  REPLY_CLASSIFICATIONS,
  classifyReply,
  type ReplyClassification,
} from '../lib/email/replyClassification';
import { processInboundReply } from '../lib/email/inboundOperations';

function arg(name: string, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.filter((piece) => piece.startsWith(prefix)).pop();
  return match ? match.slice(prefix.length) : fallback;
}

const email = arg('email').trim().toLowerCase();
const status = arg('status', 'replied').trim().toLowerCase();
const note = arg('note').trim();
const subject = arg('subject', 'Operator-recorded reply').trim();
const mailbox = arg('mailbox', process.env.FROM_EMAIL || 'acquisitions@vestblock.io')
  .trim()
  .toLowerCase();
const dryRun = process.argv.includes('--dry-run');

const statusMap: Record<string, ReplyClassification> = {
  replied: 'needs_human_review',
  interested: 'positive_interested',
  qualified: 'positive_interested',
  closed_won: 'positive_interested',
  more_info: 'requesting_more_information',
  price_terms: 'price_terms_provided',
  call_requested: 'call_requested',
  not_now: 'not_now',
  follow_up_later: 'follow_up_later',
  not_interested: 'not_interested',
  opt_out: 'unsubscribe',
  unsubscribe: 'unsubscribe',
  wrong_owner: 'wrong_person',
  property_sold: 'property_sold',
  already_funded: 'already_funded',
  auto_reply: 'auto_reply',
  bounced: 'bounce',
  spam: 'spam_irrelevant',
};

const classification = statusMap[status] ||
  (REPLY_CLASSIFICATIONS.includes(status as ReplyClassification)
    ? (status as ReplyClassification)
    : null);

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Pass a valid --email= address.');
}
if (!classification) {
  throw new Error(
    `Unknown --status. Use one of: ${Object.keys(statusMap).join(', ')}, ${REPLY_CLASSIFICATIONS.join(', ')}`
  );
}

const text = note || `Human operator classified this reply as ${classification}.`;
const preview = classifyReply({
  fromEmail: email,
  subject,
  text,
  classificationOverride: classification,
});

async function main() {
  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          email,
          classification: preview.classification,
          sequenceAction: preview.sequenceAction,
          globalSuppress: preview.globalSuppress,
          nextStep: preview.nextStep,
        },
        null,
        2
      )
    );
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials are required.');
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const timestamp = new Date().toISOString();
  const result = await processInboundReply(admin, {
    provider: 'operator',
    providerEventId: `operator:${timestamp}:${email}`,
    providerMessageId: `operator:${timestamp}:${email}`,
    mailbox,
    fromEmail: email,
    subject,
    text,
    receivedAt: timestamp,
    classificationOverride: classification,
  });
  console.log(
    JSON.stringify(
      {
        stored: true,
        classification: result.classification,
        leadId: result.leadId,
        strategyKey: result.strategyKey,
        sequenceAction: result.sequenceAction,
        taskCreated: Boolean(result.taskId),
        suppressed: Boolean(result.suppressionId),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('log-reply failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
