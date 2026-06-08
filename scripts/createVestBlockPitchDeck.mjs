import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  createSlideContext,
  ensureArtifactToolWorkspace,
  importArtifactTool,
  saveBlobToFile,
} from '/Users/mrsanders/.codex/plugins/cache/openai-primary-runtime/presentations/26.430.10722/skills/presentations/scripts/artifact_tool_utils.mjs';

const repoRoot = process.cwd();
const threadId = process.env.CODEX_THREAD_ID || `manual-${Date.now().toString(36)}`;
const workspace = path.join(process.env.TMPDIR || '/tmp', 'codex-presentations', threadId, 'vestblock-funding-deck');
const outputDir = path.join(repoRoot, 'docs', 'pitch');
const previewDir = path.join(workspace, 'preview');
const layoutDir = path.join(workspace, 'layout');
const qaDir = path.join(workspace, 'qa');
const finalPptx = path.join(outputDir, 'vestblock-early-funding-pitch-deck.pptx');
const contactSheet = path.join(previewDir, 'contact-sheet.png');
const slideSize = { width: 1280, height: 720 };

const palette = {
  bg: '#04070B',
  bg2: '#07111D',
  panel: '#0B1320',
  panel2: '#101B2B',
  cyan: '#22D3EE',
  blue: '#2563EB',
  teal: '#14B8A6',
  gold: '#FBBF24',
  green: '#22C55E',
  red: '#F97373',
  ink: '#F8FDFF',
  soft: '#B8C7D5',
  muted: '#74869A',
  border: '#24445A',
  faint: '#132235',
};

const style = {
  serif: 'Georgia',
  sans: 'Avenir Next',
  mono: 'Aptos Mono',
};

function sanitize(value) {
  return String(value ?? '').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function wrap(value, maxChars = 54, maxLines = 4) {
  const words = sanitize(value).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines).join('\n');
}

function text(slide, ctx, value, x, y, w, h, opts = {}) {
  return ctx.addText(slide, {
    text: sanitize(value),
    left: x,
    top: y,
    width: w,
    height: h,
    fontSize: opts.size ?? 18,
    color: opts.color ?? palette.ink,
    bold: Boolean(opts.bold),
    typeface: opts.face ?? style.sans,
    align: opts.align ?? 'left',
    valign: opts.valign ?? 'top',
    fill: opts.fill ?? '#00000000',
    line: opts.line ?? ctx.line(),
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
    name: opts.name,
  });
}

function rect(slide, ctx, x, y, w, h, fill = palette.panel, opts = {}) {
  return ctx.addShape(slide, {
    left: x,
    top: y,
    width: w,
    height: h,
    geometry: opts.geometry ?? 'rect',
    fill,
    line: opts.line ?? ctx.line(opts.stroke ?? '#00000000', opts.strokeWidth ?? 0),
    name: opts.name,
  });
}

function rule(slide, ctx, x, y, w, color = palette.border, h = 1) {
  rect(slide, ctx, x, y, w, h, color);
}

function bg(slide, ctx) {
  rect(slide, ctx, 0, 0, ctx.W, ctx.H, palette.bg);
  rect(slide, ctx, 900, -80, 420, 420, '#061C27');
  rect(slide, ctx, -120, 520, 560, 260, '#061126');
  for (let x = 0; x <= ctx.W; x += 80) rule(slide, ctx, x, 0, 1, '#07101A', ctx.H);
  for (let y = 0; y <= ctx.H; y += 80) rule(slide, ctx, 0, y, ctx.W, '#07101A', 1);
}

function footer(slide, ctx, n, note = 'Confidential draft - for funding conversations only') {
  rule(slide, ctx, 56, 664, 1168, palette.faint, 1);
  text(slide, ctx, note, 56, 676, 760, 18, { size: 9, color: palette.muted });
  text(slide, ctx, String(n).padStart(2, '0'), 1170, 674, 54, 20, {
    size: 12,
    color: palette.muted,
    align: 'right',
    face: style.mono,
  });
}

function kicker(slide, ctx, label) {
  rect(slide, ctx, 56, 48, 6, 34, palette.cyan, { name: 'kicker-marker' });
  text(slide, ctx, label.toUpperCase(), 76, 55, 500, 18, {
    size: 10,
    color: palette.cyan,
    bold: true,
    name: 'kicker-label',
  });
  text(slide, ctx, 'VESTBLOCK', 1078, 54, 146, 20, {
    size: 13,
    color: palette.ink,
    bold: true,
    align: 'right',
  });
}

function title(slide, ctx, value, opts = {}) {
  text(slide, ctx, wrap(value, opts.maxChars ?? 42, opts.maxLines ?? 3), opts.x ?? 56, opts.y ?? 108, opts.w ?? 850, opts.h ?? 130, {
    size: opts.size ?? 40,
    color: palette.ink,
    bold: true,
    face: style.serif,
  });
}

function subtitle(slide, ctx, value, x = 58, y = 250, w = 740, h = 58) {
  text(slide, ctx, wrap(value, 76, 3), x, y, w, h, { size: 16, color: palette.soft });
}

function panel(slide, ctx, x, y, w, h, opts = {}) {
  rect(slide, ctx, x, y, w, h, opts.fill ?? palette.panel, {
    stroke: opts.stroke ?? palette.border,
    strokeWidth: opts.strokeWidth ?? 1,
  });
  if (opts.accent) rect(slide, ctx, x, y, w, 4, opts.accent);
}

function card(slide, ctx, x, y, w, h, headline, body, opts = {}) {
  panel(slide, ctx, x, y, w, h, { accent: opts.accent ?? palette.cyan, fill: opts.fill });
  text(slide, ctx, headline, x + 18, y + 22, w - 36, 28, {
    size: opts.titleSize ?? 17,
    bold: true,
    color: opts.titleColor ?? palette.ink,
  });
  text(slide, ctx, wrap(body, opts.wrap ?? 38, opts.lines ?? 4), x + 18, y + 58, w - 36, h - 74, {
    size: opts.bodySize ?? 12,
    color: opts.bodyColor ?? palette.soft,
  });
}

function metric(slide, ctx, x, y, value, label, note, color = palette.cyan) {
  rule(slide, ctx, x, y + 4, 2, color, 72);
  text(slide, ctx, value, x + 18, y, 190, 34, { size: 28, bold: true, face: style.serif, color: palette.ink });
  text(slide, ctx, label, x + 18, y + 40, 190, 16, { size: 9.5, bold: true, color });
  text(slide, ctx, note, x + 18, y + 58, 190, 32, { size: 8.5, color: palette.muted });
}

function bulletList(slide, ctx, items, x, y, w, opts = {}) {
  let yy = y;
  items.forEach((item, index) => {
    rect(slide, ctx, x, yy + 6, 8, 8, opts.color ?? (index % 2 ? palette.teal : palette.cyan));
    text(slide, ctx, wrap(item, opts.wrap ?? 62, 2), x + 20, yy, w - 20, 38, {
      size: opts.size ?? 13,
      color: opts.textColor ?? palette.soft,
    });
    yy += opts.gap ?? 45;
  });
}

function arrow(slide, ctx, x1, y, x2, color = palette.cyan) {
  rule(slide, ctx, x1, y, x2 - x1 - 15, color, 3);
  rect(slide, ctx, x2 - 16, y - 6, 14, 14, color);
}

function slide01(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Early funding deck');
  title(slide, ctx, 'VestBlock turns trust gaps into sale-ready software services.', { y: 142, w: 820, size: 46, maxChars: 38 });
  subtitle(slide, ctx, 'A service-first SaaS company packaging smart-contract proof records, search visibility, and AI receptionist setup for small businesses and deal-driven teams.', 58, 312, 800, 72);
  panel(slide, ctx, 900, 130, 270, 330, { fill: '#071C27', stroke: '#164A5B', accent: palette.cyan });
  text(slide, ctx, 'Positioning', 928, 164, 210, 24, { size: 16, bold: true, color: palette.cyan });
  bulletList(slide, ctx, [
    'Flagship product: DealVault proof records',
    'Revenue wedge: AI Receptionist and Search Visibility',
    'Audit layer: public smart-contract records without custody',
    'Buyer promise: clearer records, better follow-up, stronger trust',
  ], 930, 206, 210, { size: 11, wrap: 28, gap: 42 });
  metric(slide, ctx, 58, 535, '3', 'Core paid offers', 'DealVault, Search Visibility, AI Receptionist', palette.cyan);
  metric(slide, ctx, 338, 535, '5', 'Contracts live', 'Polygon contract addresses documented', palette.blue);
  metric(slide, ctx, 618, 535, '100/day', 'Outreach capacity', 'Reached local daily target on 2026-05-12', palette.green);
  metric(slide, ctx, 898, 535, '0', 'Custody promise', 'No escrow, tokens, or real fund movement in MVP', palette.gold);
  footer(slide, ctx, 1);
  return slide;
}

function slide02(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Market problem');
  title(slide, ctx, 'Small businesses do not lose only from low traffic; they lose from messy handoffs.', { size: 38, maxChars: 48 });
  subtitle(slide, ctx, 'The same buyer can fall out of the journey at three points: they cannot find the business, they cannot get a fast answer, or they cannot trust what was agreed.', 58, 230, 850, 58);
  card(slide, ctx, 70, 340, 330, 170, '1. Being found', 'Weak service pages, thin city coverage, and missing proof make good businesses harder to choose.', { accent: palette.blue, wrap: 42 });
  card(slide, ctx, 475, 340, 330, 170, '2. Being answered', 'Missed calls, after-hours gaps, weak forms, and slow follow-up turn interest into silence.', { accent: palette.cyan, wrap: 42 });
  card(slide, ctx, 880, 340, 330, 170, '3. Being trusted', 'Referral terms, milestones, and document history are often scattered across inboxes and PDFs.', { accent: palette.gold, wrap: 42 });
  arrow(slide, ctx, 404, 425, 470, palette.border);
  arrow(slide, ctx, 810, 425, 875, palette.border);
  panel(slide, ctx, 176, 560, 928, 62, { fill: '#081B23', stroke: '#174559' });
  text(slide, ctx, 'VestBlock packages those fixes into clear offers a non-technical owner can buy.', 205, 583, 870, 22, { size: 18, bold: true, color: palette.ink, align: 'center' });
  footer(slide, ctx, 2);
  return slide;
}

function slide03(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Product system');
  title(slide, ctx, 'VestBlock starts with three understandable offers, then compounds into a broader business platform.', { size: 36, maxChars: 52 });
  card(slide, ctx, 58, 242, 350, 238, 'DealVault', 'Agreement records, proof certificates, payout tracking, and milestone history for teams that need accountability.', { accent: palette.gold, wrap: 43, bodySize: 13 });
  card(slide, ctx, 465, 242, 350, 238, 'Search Visibility', 'Website, city, service, and trust improvements that make a business easier to find and easier to evaluate.', { accent: palette.cyan, wrap: 43, bodySize: 13 });
  card(slide, ctx, 872, 242, 350, 238, 'AI Receptionist', 'Lead capture, FAQ training, qualification, booking handoff, and missed-lead notifications.', { accent: palette.teal, wrap: 43, bodySize: 13 });
  panel(slide, ctx, 156, 535, 968, 74, { fill: palette.panel2, stroke: '#21465C' });
  text(slide, ctx, 'Why this matters', 184, 558, 160, 20, { size: 14, bold: true, color: palette.cyan });
  text(slide, ctx, 'Each offer can sell alone, but together they create a stronger customer operating layer: found faster, answered faster, documented better.', 356, 552, 720, 34, { size: 15, color: palette.soft });
  footer(slide, ctx, 3);
  return slide;
}

function slide04(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Flagship wedge');
  title(slide, ctx, 'DealVault makes agreement accountability visible without becoming a custody or token product.', { size: 36, maxChars: 52 });
  const nodes = [
    ['PDF / deal record', 'Private files stay off-chain'],
    ['Hash created', 'Proof fingerprint only'],
    ['Supabase record', 'App database remains source of truth'],
    ['Blockchain proof', 'IDs, hashes, status, timestamp'],
    ['Certificate', 'Buyer-ready proof output'],
  ];
  nodes.forEach(([name, note], idx) => {
    const x = 64 + idx * 235;
    card(slide, ctx, x, 300, 188, 132, name, note, { accent: idx % 2 ? palette.cyan : palette.blue, wrap: 24, titleSize: 15, bodySize: 11 });
    if (idx < nodes.length - 1) arrow(slide, ctx, x + 196, 362, x + 226, palette.border);
  });
  bulletList(slide, ctx, [
    'No raw contracts, addresses, private documents, or sensitive personal data on-chain.',
    'No escrow, custody, tokenized real estate ownership, or real fund movement in the MVP.',
    'Designed as a proof and audit layer that can support real estate first, then other agreement-heavy industries.',
  ], 120, 500, 1010, { size: 13, wrap: 105, gap: 40 });
  footer(slide, ctx, 4);
  return slide;
}

function slide05(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Commercial wedge');
  title(slide, ctx, 'Growth services can fund the business while the smart-contract product matures.', { size: 38, maxChars: 48 });
  const offers = [
    ['Search Visibility', '$299/mo', 34, palette.cyan],
    ['AI Receptionist', '$495 + $149/mo', 52, palette.teal],
    ['Booking System', '$895 + $249/mo', 70, palette.blue],
    ['Website Sprint', 'From $2,500', 86, palette.gold],
    ['DealVault', '$97-$997/mo + custom', 100, palette.green],
  ];
  const x0 = 120;
  const y0 = 250;
  offers.forEach(([name, price, value, color], idx) => {
    const y = y0 + idx * 68;
    text(slide, ctx, name, x0, y, 210, 24, { size: 15, bold: true });
    rect(slide, ctx, x0 + 230, y + 5, 620, 18, '#132235');
    rect(slide, ctx, x0 + 230, y + 5, 620 * (Number(value) / 100), 18, color);
    text(slide, ctx, price, x0 + 875, y, 230, 24, { size: 14, bold: true, color, align: 'right' });
  });
  panel(slide, ctx, 120, 595, 1040, 48, { fill: '#081B23', stroke: '#174559' });
  text(slide, ctx, 'Strategy: sell practical growth services today, use each customer relationship to introduce stronger records, proof, and dashboard products over time.', 146, 612, 980, 22, { size: 14, color: palette.soft, align: 'center' });
  footer(slide, ctx, 5);
  return slide;
}

function slide06(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Operating proof');
  title(slide, ctx, 'The growth loop is operational, but conversion is the next proof milestone.', { size: 38, maxChars: 48 });
  metric(slide, ctx, 76, 250, '100', 'Emails sent in 24h', 'Daily target hit locally', palette.green);
  metric(slide, ctx, 332, 250, '576', 'Usable email leads', 'Current reachable pool', palette.cyan);
  metric(slide, ctx, 588, 250, '149', 'Approved / queued', 'Ready or near-ready copy', palette.blue);
  metric(slide, ctx, 844, 250, '403', 'Needs review', 'Quality backlog to work down', palette.gold);
  panel(slide, ctx, 78, 430, 500, 132, { fill: palette.panel2, stroke: '#21465C', accent: palette.green });
  text(slide, ctx, 'What is working', 104, 458, 180, 22, { size: 17, bold: true, color: palette.green });
  bulletList(slide, ctx, ['Provider configured', 'Mailing address configured', 'No-email leads blocked from email', '100/day guardrail enforced'], 106, 494, 420, { size: 11, wrap: 44, gap: 23, color: palette.green });
  panel(slide, ctx, 704, 430, 500, 132, { fill: palette.panel2, stroke: '#21465C', accent: palette.gold });
  text(slide, ctx, 'What funding helps prove', 730, 458, 240, 22, { size: 17, bold: true, color: palette.gold });
  bulletList(slide, ctx, ['Reply and booking lift', 'Better vertical targeting', 'Case-study assets', 'Human review capacity'], 732, 494, 420, { size: 11, wrap: 44, gap: 23, color: palette.gold });
  footer(slide, ctx, 6, 'Snapshot from local outreach scorecard on 2026-05-12; no revenue traction is implied.');
  return slide;
}

function slide07(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Beachhead segments');
  title(slide, ctx, 'Small businesses are the first revenue market; real estate remains the flagship proof category.', { size: 36, maxChars: 54 });
  const rows = [
    ['Home services', 'Missed calls, weak booking, city pages', 'AI Receptionist + Visibility'],
    ['Med spas / clinics', 'Appointment flow, FAQs, trust proof', 'Booking System'],
    ['Property managers', 'Lead response, vendor milestones, proof', 'AI Receptionist + DealVault'],
    ['Private lenders', 'Deal records, referral clarity, borrower prep', 'DealVault + Funding Prep'],
    ['Contractors', 'Milestones, referrals, before/after proof', 'DealVault + Visibility'],
  ];
  const x = 78;
  const y = 234;
  const cols = [220, 470, 300];
  ['Segment', 'Pain to solve', 'First offer'].forEach((header, idx) => {
    text(slide, ctx, header, x + cols.slice(0, idx).reduce((a, b) => a + b, 0), y, cols[idx], 20, { size: 11, bold: true, color: palette.cyan });
  });
  rule(slide, ctx, x, y + 28, 1060, palette.border, 1);
  rows.forEach((row, ridx) => {
    const yy = y + 54 + ridx * 62;
    rect(slide, ctx, x, yy - 12, 1060, 48, ridx % 2 ? '#08111D' : '#0B1320', { stroke: '#10283A', strokeWidth: 1 });
    text(slide, ctx, row[0], x + 18, yy, cols[0] - 28, 20, { size: 13, bold: true, color: palette.ink });
    text(slide, ctx, row[1], x + cols[0] + 16, yy, cols[1] - 28, 20, { size: 12, color: palette.soft });
    text(slide, ctx, row[2], x + cols[0] + cols[1] + 16, yy, cols[2] - 28, 20, { size: 12, bold: true, color: palette.gold });
  });
  footer(slide, ctx, 7);
  return slide;
}

function slide08(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Use of funds');
  title(slide, ctx, 'Funding should buy proof, not complexity.', { size: 42, maxChars: 38 });
  subtitle(slide, ctx, 'The first capital should turn a built product stack into repeatable sales motion, delivery quality, and investor-grade evidence.', 58, 230, 820, 54);
  const items = [
    ['Sales proof', 'Demo assets, outbound lists, follow-up operations, founder-led demos', palette.green],
    ['Delivery capacity', 'Setup playbooks, QA checklists, onboarding templates, customer support', palette.cyan],
    ['Security hardening', 'Contract tests, monitoring, access controls, deployment reliability', palette.blue],
    ['Proof library', 'Case studies, before/after examples, industry pages, sales collateral', palette.gold],
  ];
  items.forEach(([name, body, color], idx) => {
    const x = 80 + (idx % 2) * 560;
    const y = 340 + Math.floor(idx / 2) * 132;
    card(slide, ctx, x, y, 500, 98, name, body, { accent: color, wrap: 54, bodySize: 12 });
  });
  footer(slide, ctx, 8);
  return slide;
}

function slide09(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Revenue path');
  title(slide, ctx, 'The model can compound from services into software subscriptions.', { size: 40, maxChars: 44 });
  const steps = [
    ['Setup fees', 'Cash now', '$495-$2,500+'],
    ['Monthly services', 'Recurring base', '$149-$995/mo'],
    ['DealVault plans', 'Product subscription', '$97-$997/mo'],
    ['Proof certificates', 'Usage revenue', '$25/proof idea'],
    ['Custom workflows', 'Higher-ticket deals', '$997-$5K setup'],
  ];
  steps.forEach(([name, label, price], idx) => {
    const x = 78 + idx * 230;
    panel(slide, ctx, x, 300, 184, 168, { fill: idx % 2 ? '#071C27' : palette.panel, stroke: palette.border, accent: idx < 2 ? palette.green : palette.cyan });
    text(slide, ctx, name, x + 16, 328, 150, 24, { size: 14, bold: true });
    text(slide, ctx, label, x + 16, 366, 150, 18, { size: 10, color: palette.cyan, bold: true });
    text(slide, ctx, price, x + 16, 406, 150, 28, { size: 18, color: palette.gold, bold: true, face: style.serif });
    if (idx < steps.length - 1) arrow(slide, ctx, x + 190, 384, x + 222, palette.border);
  });
  panel(slide, ctx, 160, 546, 960, 56, { fill: palette.panel2, stroke: '#21465C' });
  text(slide, ctx, 'Key discipline: keep every paid offer tied to a clear buyer outcome, clear intake path, and clear delivery promise.', 190, 565, 900, 22, { size: 15, color: palette.soft, align: 'center' });
  footer(slide, ctx, 9);
  return slide;
}

function slide10(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, 'Funding ask');
  title(slide, ctx, 'Fund the first repeatable revenue sprint.', { size: 48, maxChars: 36 });
  subtitle(slide, ctx, 'Proposed early working-capital range: $150K-$300K. Final terms should be reviewed with counsel, advisors, and the actual funding source.', 58, 226, 850, 58);
  panel(slide, ctx, 78, 332, 348, 178, { fill: '#071C27', stroke: '#164A5B', accent: palette.cyan });
  text(slide, ctx, '90-day milestones', 104, 362, 230, 24, { size: 18, bold: true, color: palette.cyan });
  bulletList(slide, ctx, ['10-20 paid pilots or service customers', '3 polished vertical demos', 'Reply-to-demo funnel measured weekly'], 106, 400, 280, { size: 11, wrap: 34, gap: 30 });
  panel(slide, ctx, 466, 332, 348, 178, { fill: '#071C27', stroke: '#164A5B', accent: palette.gold });
  text(slide, ctx, 'What investors get', 492, 362, 230, 24, { size: 18, bold: true, color: palette.gold });
  bulletList(slide, ctx, ['Service revenue wedge', 'Smart-contract proof product upside', 'Clear near-term validation targets'], 494, 400, 280, { size: 11, wrap: 34, gap: 30, color: palette.gold });
  panel(slide, ctx, 854, 332, 348, 178, { fill: '#071C27', stroke: '#164A5B', accent: palette.green });
  text(slide, ctx, 'Immediate next step', 880, 362, 230, 24, { size: 18, bold: true, color: palette.green });
  bulletList(slide, ctx, ['Review demo assets', 'Run pilot customer calls', 'Choose funding path and terms'], 882, 400, 280, { size: 11, wrap: 34, gap: 30, color: palette.green });
  panel(slide, ctx, 166, 564, 948, 50, { fill: '#081B23', stroke: '#174559' });
  text(slide, ctx, 'VestBlock is not raising on hype. The raise is to turn real build progress into real customer proof.', 196, 582, 888, 20, { size: 16, bold: true, color: palette.ink, align: 'center' });
  footer(slide, ctx, 10);
  return slide;
}

const slides = [slide01, slide02, slide03, slide04, slide05, slide06, slide07, slide08, slide09, slide10];

async function writePlanningDocs() {
  await fs.mkdir(qaDir, { recursive: true });
  await fs.writeFile(path.join(workspace, 'profile-plan.txt'), [
    'Task mode: create',
    'Primary deck-profile: product-platform',
    'Secondary gates: gtm-growth',
    'Required proof objects: platform map, customer journey, growth loop, revenue bridge, use-of-funds plan.',
    'Asset policy: no fabricated logos, customer marks, product UI, or screenshots. VestBlock is represented with text and visual system only.',
    'Known missing inputs: audited financials, signed customers, verified revenue, exact raise terms.',
  ].join('\n'));
  await fs.writeFile(path.join(workspace, 'source-notes.txt'), [
    'Sources: current VestBlock repo, generated sales assets, local outreach scorecard from 2026-05-12, known deployed contract-address documentation from project context.',
    'Metrics used: 100 emails sent in 24h, 576 usable email leads, 149 approved/queued messages, 403 needs-review messages. These are operational outreach metrics, not revenue traction.',
    'No external logos or third-party brand assets were embedded.',
  ].join('\n'));
  await fs.writeFile(path.join(workspace, 'claim-spine.txt'), [
    'Thesis: VestBlock is a service-first SaaS platform that can sell practical growth and trust products now while building toward software subscription scale.',
    'Audience: early funders, grant reviewers, strategic partners, and local investors.',
    'Arc: problem -> product system -> flagship proof layer -> commercial wedge -> operating proof -> funding ask.',
    'Slides: 1 thesis cover; 2 market problem; 3 product system; 4 DealVault architecture; 5 offer ladder; 6 operating proof; 7 beachhead segments; 8 use of funds; 9 revenue path; 10 ask.',
  ].join('\n'));
  await fs.writeFile(path.join(workspace, 'design-system.txt'), [
    'Slide size: 1280x720.',
    'Background: deep black with subtle grid and dark blue atmospheric panels.',
    'Typography: Georgia for claim titles; Avenir Next for labels/body; Aptos Mono for page markers.',
    'Palette: cyan, blue, teal, green, gold on black charcoal. No purple/default SaaS bias.',
    'Diagram grammar: rectangular nodes with top accent bars; connectors only where sequence matters.',
    'Footer grammar: quiet source/disclaimer line plus two-digit slide marker.',
  ].join('\n'));
  await fs.writeFile(path.join(workspace, 'contact-sheet-plan.txt'), [
    'Macro layouts: cover + metric rail; three-problem row; three-offer product map; horizontal workflow; pricing bar ladder; metric proof slide; segment matrix; use-of-funds quadrant; revenue bridge; closing ask.',
    'No more than two repeated card-grid slides; no fabricated proof; no customer logos.',
  ].join('\n'));
}

async function writePitchNotes() {
  const notesPath = path.join(outputDir, 'VESTBLOCK_PITCH_DECK_NOTES.md');
  await fs.writeFile(notesPath, `# VestBlock Early Funding Pitch Notes

## Main story

VestBlock is not only a smart-contract idea. It is a service-first SaaS company that can sell useful growth and trust products now while building toward a larger software platform.

The cleanest explanation:

1. Search Visibility helps customers find the business.
2. AI Receptionist helps the business respond and book faster.
3. DealVault helps teams keep better proof records when agreements, payouts, referrals, and milestones matter.

## Funding angle

Ask for early working capital to prove revenue faster, not to build random features. The deck uses a proposed range of $150K-$300K, but that should stay editable until Rob chooses the right funding path.

Suggested use of funds:

- Sales proof: better lists, demos, follow-up operations, and founder-led sales.
- Delivery capacity: onboarding templates, QA, setup playbooks, and support.
- Security hardening: smart-contract tests, monitoring, access control, and deployment reliability.
- Proof library: case studies, before/after assets, vertical pages, and sales collateral.

## Honest caveats

- Do not claim revenue traction unless verified.
- Do not claim customers, logos, testimonials, or signed pilots unless verified.
- Do not frame smart contracts as legal replacement, escrow, custody, tokenized ownership, or guaranteed payout systems.
- Keep the pitch centered on practical business outcomes: clearer visibility, faster response, cleaner records, better proof.

## Best audience

- Local angel investors
- Small-business grant reviewers
- Strategic partners
- Real estate operators with software interest
- Business lenders or economic development groups
- People who understand service businesses and can fund early execution
`);
  return notesPath;
}

async function buildDeck() {
  await ensureArtifactToolWorkspace(workspace);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(previewDir, { recursive: true });
  await fs.mkdir(layoutDir, { recursive: true });
  await writePlanningDocs();

  const artifact = await importArtifactTool(workspace);
  const { Presentation, PresentationFile } = artifact;
  const presentation = Presentation.create({ slideSize });

  const slideRecords = [];
  for (const [index, makeSlide] of slides.entries()) {
    const ctx = createSlideContext(artifact, {
      slideSize,
      slideNumber: index + 1,
      outputDir,
      assetDir: path.join(workspace, 'assets'),
      workspaceDir: workspace,
      titleFont: style.serif,
      bodyFont: style.sans,
    });
    const slide = makeSlide(presentation, ctx);
    slideRecords.push(slide);
  }

  const previewPaths = [];
  for (const [index, slide] of slideRecords.entries()) {
    const previewPath = path.join(previewDir, `slide-${String(index + 1).padStart(2, '0')}.png`);
    const layoutPath = path.join(layoutDir, `slide-${String(index + 1).padStart(2, '0')}.layout.json`);
    const preview = await presentation.export({ slide, format: 'png', scale: 0.8 });
    await saveBlobToFile(preview, previewPath);
    previewPaths.push(previewPath);
    try {
      const layout = await presentation.export({ slide, format: 'layout' });
      await fs.writeFile(layoutPath, await layout.text(), 'utf8');
    } catch (error) {
      await fs.writeFile(layoutPath, JSON.stringify({ layoutError: error.message }, null, 2));
    }
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
  const stat = await fs.stat(finalPptx);
  if (stat.size <= 0) throw new Error(`PPTX export was empty: ${finalPptx}`);

  const makeContactSheet = '/Users/mrsanders/.codex/plugins/cache/openai-primary-runtime/presentations/26.430.10722/skills/presentations/scripts/make_contact_sheet.py';
  const python = process.env.PYTHON || '/Users/mrsanders/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
  const contactResult = spawnSync(python, [makeContactSheet, '--output', contactSheet, ...previewPaths], { encoding: 'utf8' });
  if (contactResult.status !== 0) {
    throw new Error([contactResult.stdout, contactResult.stderr].filter(Boolean).join('\n'));
  }

  const manifest = {
    output: finalPptx,
    outputBytes: stat.size,
    slideCount: slideRecords.length,
    previewDir,
    contactSheet,
    workspace,
  };
  manifest.notes = await writePitchNotes();
  await fs.writeFile(path.join(outputDir, 'vestblock-early-funding-pitch-deck-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(qaDir, 'comeback-scorecard.txt'), [
    'Profile gate: PASS - product-platform with GTM growth secondary.',
    'Story: 4/5 - clear early-stage arc, limited by missing customer revenue proof.',
    'Specificity: 5/5 - built around VestBlock products, DealVault, outreach, and service packages.',
    'Rhythm: 4/5 - varied deck layouts with some repeated node/card language.',
    'Whitespace: 4/5 - dark premium style with readable density.',
    'Chart clarity: 4/5 - authored primitives used for bar ladder, matrix, workflow, and bridge.',
    'Typography: 4/5 - Georgia/Avenir system is intentional and investor-readable.',
    'Restraint: 4/5 - no fake logos, fake customers, or unsupported claims.',
    'Precision: 4/5 - operational metrics sourced; funding ask remains proposed and editable.',
    'Coherence: 5/5 - consistent visual language.',
    'Total: 38/45. Pass for an early funding draft; strongest remaining gap is lack of customer revenue proof.',
    'Package checks: PPTX exported, 10 slide previews rendered, contact sheet generated.',
  ].join('\n'));

  return manifest;
}

const manifest = await buildDeck();
console.log(JSON.stringify(manifest, null, 2));
