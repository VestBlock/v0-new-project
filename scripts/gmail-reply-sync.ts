#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { classifyReply } from '../lib/email/replyClassification';
import {
  extractReplyCorrelationIds,
  processInboundReply,
} from '../lib/email/inboundOperations';

const root = process.cwd();
const statePath = path.join(root, 'data', 'operating-loops', 'reply-sync-state.json');
const ledgerPath = path.join(root, 'data', 'operating-loops', 'campaign-ledger.jsonl');
const args = process.argv.slice(2);
const apply = args.includes('--apply');

function argValue(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const match = [...args].reverse().find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const days = Math.max(1, Math.min(90, Number(argValue('days', '7')) || 7));
const max = Math.max(1, Math.min(500, Number(argValue('max', '100')) || 100));

function loadState() {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return new Set<string>(Array.isArray(state.processedMessageIds) ? state.processedMessageIds : []);
  } catch {
    return new Set<string>();
  }
}

function readLedgerRecipients() {
  const recipients = new Set<string>();
  try {
    for (const line of fs.readFileSync(ledgerPath, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.channel === 'email' && ['sent', 'accepted', 'delivered'].includes(event.status)) {
          const recipient = String(event.recipient || '').trim().toLowerCase();
          if (recipient) recipients.add(recipient);
        }
      } catch {
        // A malformed historical line is ignored; database attribution remains authoritative.
      }
    }
  } catch {
    // The local ledger is supplemental and may not exist on a fresh checkout.
  }
  return recipients;
}

function emailFromHeader(value: string) {
  const bracketed = String(value || '').match(/<([^>]+)>/);
  return (bracketed?.[1] || value || '').trim().toLowerCase();
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

type GmailPayload = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
  headers?: Array<{ name?: string; value?: string }>;
};

function collectParts(payload: GmailPayload | undefined, output = { text: [] as string[], html: [] as string[] }) {
  if (!payload) return output;
  const data = payload.body?.data;
  if (data && payload.mimeType === 'text/plain') output.text.push(decodeBase64Url(data));
  if (data && payload.mimeType === 'text/html') output.html.push(decodeBase64Url(data));
  for (const part of payload.parts || []) collectParts(part, output);
  return output;
}

function header(payload: GmailPayload | undefined, name: string) {
  return (
    payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || ''
  );
}

async function getGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN.'
    );
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Google token refresh failed (${response.status}).`);
  }
  return String(data.access_token);
}

async function gmailFetch(accessToken: string, resource: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${resource}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        'Gmail read scope is missing. Reauthorize the Google refresh token with gmail.readonly before enabling this sync.'
      );
    }
    throw new Error(`Gmail API request failed (${response.status}).`);
  }
  return data;
}

async function databaseRecipients(admin: any) {
  const recipients = new Set<string>();
  const [sendEvents, enrollments] = await Promise.all([
    admin
      .from('outreach_send_events')
      .select('recipient')
      .not('recipient', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000),
    admin
      .from('command_center_outbound_enrollments')
      .select('recipient')
      .not('recipient', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5000),
  ]);
  if (sendEvents.error) throw sendEvents.error;
  if (enrollments.error) throw enrollments.error;
  for (const row of [...(sendEvents.data || []), ...(enrollments.data || [])]) {
    const recipient = String(row.recipient || '').trim().toLowerCase();
    if (recipient) recipients.add(recipient);
  }
  return recipients;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials are required for reply attribution.');
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const knownRecipients = readLedgerRecipients();
  for (const recipient of await databaseRecipients(admin)) knownRecipients.add(recipient);
  if (!knownRecipients.size) throw new Error('No known outbound recipients are available for matching.');

  const processed = loadState();
  const accessToken = await getGoogleAccessToken();
  const query = encodeURIComponent(
    `in:inbox newer_than:${days}d -from:me -from:support@dealmachine.com`
  );
  const list = await gmailFetch(accessToken, `messages?q=${query}&maxResults=${max}`);
  const messages: Array<{ id: string; threadId?: string }> = list.messages || [];
  const newlyProcessed: string[] = [];
  let matched = 0;
  let ignored = 0;

  console.log(
    `Gmail reply sync${apply ? ' [apply]' : ' [report-only]'}: ${messages.length} inbox message(s), ${knownRecipients.size} known outbound recipient(s).`
  );

  for (const stub of messages) {
    if (processed.has(stub.id)) continue;
    const message = await gmailFetch(accessToken, `messages/${stub.id}?format=full`);
    const fromEmail = emailFromHeader(header(message.payload, 'From'));
    if (!knownRecipients.has(fromEmail)) {
      ignored += 1;
      continue;
    }

    matched += 1;
    const parts = collectParts(message.payload);
    const text = parts.text.join('\n').trim() || String(message.snippet || '');
    const html = parts.html.join('\n').trim() || null;
    const subject = header(message.payload, 'Subject');
    const toEmail = emailFromHeader(header(message.payload, 'To'));
    const receivedAt = new Date(Number(message.internalDate) || Date.now()).toISOString();
    const preview = classifyReply({ fromEmail, subject, text, html });

    if (!apply) {
      console.log(
        `  ${preview.classification.padEnd(29)} ${fromEmail} — ${preview.nextStep}`
      );
      continue;
    }

    const thread = message.threadId
      ? await gmailFetch(
          accessToken,
          `threads/${message.threadId}?format=metadata&metadataHeaders=Message-ID`
        )
      : null;
    const sentThreadMessages = (thread?.messages || []).filter(
      (item: any) => item.id !== stub.id && item.labelIds?.includes('SENT')
    );
    const correlationIds = extractReplyCorrelationIds(
      header(message.payload, 'In-Reply-To'),
      header(message.payload, 'References'),
      ...sentThreadMessages.flatMap((item: any) => [
        item.id,
        header(item.payload, 'Message-ID'),
      ])
    );

    const result = await processInboundReply(admin, {
      provider: 'gmail',
      providerEventId: `gmail:${stub.id}`,
      providerMessageId: stub.id,
      mailbox: toEmail || process.env.FROM_EMAIL || 'acquisitions@vestblock.io',
      fromEmail,
      toEmail: toEmail || null,
      subject,
      text,
      html,
      receivedAt,
      threadId: message.threadId || stub.threadId || null,
      correlationIds,
    });
    console.log(
      `  ${result.classification.padEnd(29)} ${fromEmail} — ${
        result.duplicate ? 'already processed' : 'stored and routed'
      }`
    );
    newlyProcessed.push(stub.id);
  }

  if (apply && newlyProcessed.length) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      `${JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          processedMessageIds: [...processed, ...newlyProcessed].slice(-5000),
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  }

  console.log(
    `Result: ${matched} matched repl${matched === 1 ? 'y' : 'ies'}, ${ignored} unrelated inbox message(s) ignored.`
  );
  if (!apply && matched) console.log('Run again with --apply after reviewing the classifications.');
}

main().catch((error) => {
  console.error('gmail-reply-sync failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
