import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const outDir = path.join(process.cwd(), 'public', 'sales');

const colors = {
  ink: rgb(0.94, 0.98, 1),
  muted: rgb(0.68, 0.76, 0.82),
  faint: rgb(0.43, 0.51, 0.57),
  cyan: rgb(0.08, 0.78, 0.88),
  blue: rgb(0.12, 0.36, 0.92),
  green: rgb(0.1, 0.78, 0.52),
  gold: rgb(0.95, 0.72, 0.26),
  panel: rgb(0.055, 0.074, 0.1),
  panelSoft: rgb(0.075, 0.102, 0.14),
  border: rgb(0.16, 0.28, 0.34),
  page: rgb(0.025, 0.034, 0.047),
};

function sanitize(text) {
  return String(text).replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function wrapText(text, font, size, maxWidth) {
  const words = sanitize(text).split(/\s+/);
  const lines = [];
  let line = '';

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      line = testLine;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawText(page, text, { x, y, size, font, color = colors.ink, maxWidth, lineHeight }) {
  const lines = maxWidth ? wrapText(text, font, size, maxWidth) : [sanitize(text)];
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * (lineHeight || size * 1.28),
      size,
      font,
      color,
    });
  });
  return y - lines.length * (lineHeight || size * 1.28);
}

function drawHeader(page, fonts, title, subtitle, badge) {
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: colors.page });
  page.drawCircle({ x: 500, y: 720, size: 130, color: rgb(0.02, 0.16, 0.22), opacity: 0.42 });
  page.drawCircle({ x: 95, y: 102, size: 155, color: rgb(0.06, 0.11, 0.22), opacity: 0.45 });
  page.drawRectangle({ x: 34, y: 728, width: 168, height: 28, color: rgb(0.04, 0.28, 0.34), borderColor: colors.border, borderWidth: 1 });
  drawText(page, badge.toUpperCase(), { x: 47, y: 737, size: 8.5, font: fonts.bold, color: colors.cyan });
  drawText(page, 'VESTBLOCK', { x: 456, y: 742, size: 12, font: fonts.bold, color: colors.ink });
  drawText(page, title, { x: 34, y: 686, size: 31, font: fonts.bold, maxWidth: 500, lineHeight: 37 });
  drawText(page, subtitle, { x: 36, y: 604, size: 12.8, font: fonts.regular, color: colors.muted, maxWidth: 490, lineHeight: 18 });
  page.drawLine({ start: { x: 34, y: 574 }, end: { x: 578, y: 574 }, thickness: 1, color: colors.border });
}

function drawCard(page, fonts, { x, y, w, h, title, body, accent = colors.cyan }) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
  });
  page.drawRectangle({ x, y: y + h - 4, width: w, height: 4, color: accent });
  drawText(page, title, { x: x + 14, y: y + h - 24, size: 12, font: fonts.bold, color: colors.ink, maxWidth: w - 28 });
  drawText(page, body, { x: x + 14, y: y + h - 48, size: 9.5, font: fonts.regular, color: colors.muted, maxWidth: w - 28, lineHeight: 13 });
}

function drawBullets(page, fonts, items, x, startY, maxWidth, color = colors.muted) {
  let y = startY;
  for (const item of items) {
    page.drawCircle({ x: x + 3, y: y + 2, size: 2.5, color: colors.cyan });
    y = drawText(page, item, {
      x: x + 14,
      y: y + 6,
      size: 9.5,
      font: fonts.regular,
      color,
      maxWidth,
      lineHeight: 13,
    }) - 4;
  }
  return y;
}

function drawPackageRow(page, fonts, { y, name, price, detail }) {
  page.drawRectangle({
    x: 34,
    y,
    width: 544,
    height: 45,
    color: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: 1,
  });
  drawText(page, name, { x: 48, y: y + 28, size: 11, font: fonts.bold });
  drawText(page, detail, { x: 48, y: y + 13, size: 8.5, font: fonts.regular, color: colors.muted, maxWidth: 360 });
  drawText(page, price, { x: 455, y: y + 24, size: 11, font: fonts.bold, color: colors.gold, maxWidth: 95 });
}

async function makeDoc() {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return { pdfDoc, fonts: { regular, bold } };
}

async function saveDoc(pdfDoc, fileName) {
  const bytes = await pdfDoc.save();
  const filePath = path.join(outDir, fileName);
  await writeFile(filePath, bytes);
  return filePath;
}

async function createSearchVisibilityOnePager() {
  const { pdfDoc, fonts } = await makeDoc();
  const page = pdfDoc.addPage([612, 792]);

  drawHeader(
    page,
    fonts,
    'Search Visibility That Helps Buyers Find You',
    'A productized visibility service for service businesses that need clearer pages, stronger trust, and more chances to be found before customers call a competitor.',
    'Search Visibility by VestBlock'
  );

  drawCard(page, fonts, {
    x: 34,
    y: 430,
    w: 166,
    h: 112,
    title: 'Problem',
    body: 'Customers cannot clearly find the right service, city page, proof, or next step.',
    accent: colors.blue,
  });
  drawCard(page, fonts, {
    x: 223,
    y: 430,
    w: 166,
    h: 112,
    title: 'VestBlock Fix',
    body: 'We create a clearer search and trust plan with prioritized pages, customer questions, and authority ideas.',
    accent: colors.cyan,
  });
  drawCard(page, fonts, {
    x: 412,
    y: 430,
    w: 166,
    h: 112,
    title: 'Outcome',
    body: 'A monthly plan that helps the business become easier to find and easier to trust.',
    accent: colors.green,
  });

  drawText(page, 'What we build first', { x: 34, y: 394, size: 16, font: fonts.bold });
  drawBullets(
    page,
    fonts,
    [
      'A plain-language review of the current website, calls to action, service pages, and trust gaps.',
      'A customer-question map so the site answers what buyers are already searching before they call.',
      'Priority service, city, and credibility pages that support the strongest revenue offers first.',
      'Google and AI-search friendly content direction without promising rankings or traffic guarantees.',
      'Monthly next steps so the business is not stuck paying for a vague marketing retainer.',
    ],
    40,
    370,
    500
  );

  drawText(page, 'Packages', { x: 34, y: 274, size: 16, font: fonts.bold });
  drawPackageRow(page, fonts, {
    y: 218,
    name: 'Visibility Starter',
    price: '$299/mo',
    detail: 'Website review, customer-question map, monthly content plan, and visibility scorecard.',
  });
  drawPackageRow(page, fonts, {
    y: 163,
    name: 'City Expansion Engine',
    price: '$750 setup + $349/mo',
    detail: 'City and service-page priorities for businesses expanding into more locations.',
  });
  drawPackageRow(page, fonts, {
    y: 108,
    name: 'Authority PR Engine',
    price: '$995/mo',
    detail: 'PR angles, citation targets, partner mentions, and authority-building outreach planning.',
  });

  page.drawRectangle({ x: 34, y: 42, width: 544, height: 42, color: rgb(0.04, 0.2, 0.24), borderColor: colors.border, borderWidth: 1 });
  drawText(page, 'CTA: Request a Visibility Review at vestblock.io/visibility-expansion', {
    x: 48,
    y: 63,
    size: 11,
    font: fonts.bold,
    color: colors.ink,
  });
  drawText(page, 'No rankings, traffic, citations, or revenue are guaranteed. VestBlock provides strategy, setup direction, and ongoing visibility support.', {
    x: 48,
    y: 31,
    size: 7.5,
    font: fonts.regular,
    color: colors.faint,
    maxWidth: 520,
  });

  return saveDoc(pdfDoc, 'vestblock-search-visibility-one-pager.pdf');
}

async function createAiReceptionistOnePager() {
  const { pdfDoc, fonts } = await makeDoc();
  const page = pdfDoc.addPage([612, 792]);

  drawHeader(
    page,
    fonts,
    'AI Receptionist for Missed Leads and Faster Booking',
    'A setup service for businesses that need a cleaner way to answer common questions, capture website visitors, qualify leads, and route people toward booking or follow-up.',
    'AI Receptionist by VestBlock'
  );

  drawCard(page, fonts, {
    x: 34,
    y: 430,
    w: 166,
    h: 112,
    title: 'Problem',
    body: 'Calls get missed, forms feel cold, visitors leave after hours, and staff repeat the same answers.',
    accent: colors.blue,
  });
  drawCard(page, fonts, {
    x: 223,
    y: 430,
    w: 166,
    h: 112,
    title: 'VestBlock Fix',
    body: 'We set up a trained receptionist flow that captures details and routes qualified visitors.',
    accent: colors.cyan,
  });
  drawCard(page, fonts, {
    x: 412,
    y: 430,
    w: 166,
    h: 112,
    title: 'Outcome',
    body: 'Faster response, cleaner intake, and fewer dropped opportunities.',
    accent: colors.green,
  });

  drawText(page, 'What customers get', { x: 34, y: 394, size: 16, font: fonts.bold });
  drawBullets(
    page,
    fonts,
    [
      'Website chat or receptionist setup aligned with the business offer, tone, and common questions.',
      'Lead capture fields that collect useful information instead of sending blank or vague inquiries.',
      'Qualification questions for appointment-led businesses so staff can prioritize better conversations.',
      'Booking or calendar handoff where the package includes scheduling support.',
      'Launch QA, first-round script tuning, and clear next-step recommendations after setup.',
    ],
    40,
    370,
    500
  );

  drawText(page, 'Packages', { x: 34, y: 274, size: 16, font: fonts.bold });
  drawPackageRow(page, fonts, {
    y: 218,
    name: 'AI Receptionist Launch',
    price: '$495 setup + $149/mo',
    detail: 'Website AI chat installation, FAQ training, lead capture, alerts, and launch review.',
  });
  drawPackageRow(page, fonts, {
    y: 163,
    name: 'AI Receptionist + Appointment Booking',
    price: '$895 setup + $249/mo',
    detail: 'Adds booking logic, calendar handoff, qualification questions, and missed-lead notifications.',
  });
  drawPackageRow(page, fonts, {
    y: 108,
    name: 'Website Upgrade Sprint',
    price: 'From $2,500',
    detail: 'Conversion-focused page, CTA, mobile, form, and booking-flow improvements for weak sites.',
  });

  page.drawRectangle({ x: 34, y: 42, width: 544, height: 42, color: rgb(0.04, 0.2, 0.24), borderColor: colors.border, borderWidth: 1 });
  drawText(page, 'CTA: Request AI Receptionist Setup at vestblock.io/ai-assistant', {
    x: 48,
    y: 63,
    size: 11,
    font: fonts.bold,
    color: colors.ink,
  });
  drawText(page, 'VestBlock helps with setup, training, and lead capture. Lead quality, close rate, and revenue still depend on the business and market.', {
    x: 48,
    y: 31,
    size: 7.5,
    font: fonts.regular,
    color: colors.faint,
    maxWidth: 520,
  });

  return saveDoc(pdfDoc, 'vestblock-ai-receptionist-one-pager.pdf');
}

async function createBeforeAfterPdf() {
  const { pdfDoc, fonts } = await makeDoc();
  const page = pdfDoc.addPage([612, 792]);
  drawHeader(
    page,
    fonts,
    'Before and After: Cleaner Growth Path',
    'A simple sales example showing how Search Visibility and AI Receptionist work together to turn a scattered website into a clearer path from search to lead capture.',
    'Buyer-ready example'
  );

  drawText(page, 'Before VestBlock', { x: 56, y: 520, size: 18, font: fonts.bold, color: colors.gold });
  drawText(page, 'After VestBlock', { x: 340, y: 520, size: 18, font: fonts.bold, color: colors.cyan });

  const rows = [
    ['Website is hard to understand on mobile.', 'Homepage and service pages show the offer, area, proof, and next step clearly.'],
    ['Customers search, compare, and leave.', 'Customer questions are answered before the visitor has to call.'],
    ['Contact form asks too little and creates bad leads.', 'Lead capture asks the right questions and routes the inquiry.'],
    ['After-hours visitors wait until morning or disappear.', 'AI receptionist can respond immediately and collect details.'],
    ['Owner guesses what to fix next.', 'VestBlock gives a clear first 7 days and monthly improvement plan.'],
  ];

  let y = 478;
  for (const [before, after] of rows) {
    page.drawRectangle({ x: 34, y: y - 49, width: 260, height: 58, color: colors.panel, borderColor: colors.border, borderWidth: 1 });
    page.drawRectangle({ x: 318, y: y - 49, width: 260, height: 58, color: colors.panelSoft, borderColor: colors.border, borderWidth: 1 });
    drawText(page, before, { x: 50, y: y - 12, size: 10, font: fonts.regular, color: colors.muted, maxWidth: 224, lineHeight: 13 });
    drawText(page, after, { x: 334, y: y - 12, size: 10, font: fonts.regular, color: colors.ink, maxWidth: 224, lineHeight: 13 });
    y -= 70;
  }

  page.drawRectangle({ x: 34, y: 60, width: 544, height: 72, color: rgb(0.04, 0.2, 0.24), borderColor: colors.border, borderWidth: 1 });
  drawText(page, 'Sales takeaway', { x: 50, y: 106, size: 13, font: fonts.bold });
  drawText(page, 'VestBlock does not just add a chatbot or write random content. The value is making the buyer journey easier to find, easier to trust, and easier to act on.', {
    x: 50,
    y: 87,
    size: 10,
    font: fonts.regular,
    color: colors.muted,
    maxWidth: 500,
    lineHeight: 14,
  });

  return saveDoc(pdfDoc, 'vestblock-before-after-growth-example.pdf');
}

async function createSevenDayPlanPdf() {
  const { pdfDoc, fonts } = await makeDoc();
  const page = pdfDoc.addPage([612, 792]);
  drawHeader(
    page,
    fonts,
    'The First 7 Days With VestBlock Growth Services',
    'A buyer-friendly launch plan for Search Visibility, AI Receptionist, or both. It gives prospects a concrete picture of what happens after they raise their hand.',
    '7-day launch plan'
  );

  const days = [
    ['Day 1', 'Review the website, offer, market, forms, calls to action, and current lead path.'],
    ['Day 2', 'Map where visitors are getting lost and choose the highest-value first fix.'],
    ['Day 3', 'Build the first recommendation set: pages, questions, booking path, or receptionist flow.'],
    ['Day 4', 'Prepare the initial setup plan and confirm what access or business details are needed.'],
    ['Day 5', 'Draft the customer-facing answers, lead questions, service-page ideas, and handoff logic.'],
    ['Day 6', 'QA the experience on desktop and mobile, then test form and alert behavior.'],
    ['Day 7', 'Deliver the first summary, priority list, and next 30-day plan for growth work.'],
  ];

  let y = 520;
  for (const [day, detail] of days) {
    page.drawCircle({ x: 54, y: y - 6, size: 14, color: rgb(0.04, 0.28, 0.34), borderColor: colors.cyan, borderWidth: 1 });
    drawText(page, day, { x: 93, y, size: 12, font: fonts.bold, color: colors.ink });
    drawText(page, detail, { x: 93, y: y - 18, size: 10, font: fonts.regular, color: colors.muted, maxWidth: 440, lineHeight: 14 });
    if (y > 132) {
      page.drawLine({ start: { x: 54, y: y - 22 }, end: { x: 54, y: y - 54 }, thickness: 1, color: colors.border });
    }
    y -= 62;
  }

  page.drawRectangle({ x: 34, y: 42, width: 544, height: 52, color: colors.panelSoft, borderColor: colors.border, borderWidth: 1 });
  drawText(page, 'Best first use', { x: 50, y: 72, size: 11, font: fonts.bold, color: colors.cyan });
  drawText(page, 'Use Search Visibility when the business needs more qualified visitors. Use AI Receptionist when leads are already arriving but getting missed, delayed, or poorly qualified.', {
    x: 150,
    y: 72,
    size: 9.5,
    font: fonts.regular,
    color: colors.muted,
    maxWidth: 395,
    lineHeight: 13,
  });

  return saveDoc(pdfDoc, 'vestblock-7-day-growth-launch-plan.pdf');
}

async function createFlowchartSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900" role="img" aria-label="VestBlock Search Visibility and AI Receptionist flowchart">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#05070b"/>
      <stop offset="52%" stop-color="#07131d"/>
      <stop offset="100%" stop-color="#02050a"/>
    </linearGradient>
    <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      .title{font:700 54px Arial,Helvetica,sans-serif;fill:#f8fdff}
      .sub{font:400 24px Arial,Helvetica,sans-serif;fill:#b7c7d4}
      .label{font:700 25px Arial,Helvetica,sans-serif;fill:#f8fdff}
      .body{font:400 20px Arial,Helvetica,sans-serif;fill:#b7c7d4}
      .small{font:700 18px Arial,Helvetica,sans-serif;fill:#22d3ee;letter-spacing:2px}
    </style>
  </defs>
  <rect width="1400" height="900" fill="url(#bg)"/>
  <circle cx="1220" cy="120" r="210" fill="#0ea5e9" opacity=".12"/>
  <circle cx="140" cy="780" r="260" fill="#2563eb" opacity=".12"/>
  <text x="80" y="95" class="small">VESTBLOCK GROWTH SYSTEM</text>
  <text x="80" y="165" class="title">From being found to being booked</text>
  <text x="82" y="210" class="sub">Search Visibility brings better visitors in. AI Receptionist helps turn them into cleaner conversations.</text>

  ${flowNode(80, 320, '1', 'Customer Searches', 'They look for a service, city, question, or problem your business can solve.')}
  ${flowNode(405, 320, '2', 'Search Visibility', 'VestBlock improves pages, answers, city coverage, and trust proof so the business is easier to find.')}
  ${flowNode(730, 320, '3', 'Website Converts', 'The visitor sees a clear offer, stronger proof, and a next step that does not feel confusing.')}
  ${flowNode(1055, 320, '4', 'AI Receptionist', 'The assistant answers common questions, captures details, qualifies the lead, and routes booking or follow-up.')}

  <path d="M345 410 C375 410, 375 410, 405 410" stroke="url(#cyan)" stroke-width="5" fill="none" filter="url(#glow)"/>
  <path d="M670 410 C700 410, 700 410, 730 410" stroke="url(#cyan)" stroke-width="5" fill="none" filter="url(#glow)"/>
  <path d="M995 410 C1025 410, 1025 410, 1055 410" stroke="url(#cyan)" stroke-width="5" fill="none" filter="url(#glow)"/>

  <rect x="180" y="640" width="1040" height="140" rx="32" fill="#0b1320" stroke="#1f4353"/>
  <text x="230" y="700" class="label">Result: better demand capture</text>
  <text x="230" y="742" class="body">More people can understand the business, ask the right questions, leave useful information, and move toward a real sales conversation.</text>
  <text x="230" y="818" class="body" fill="#7f92a3">No rankings, lead volume, bookings, or revenue are guaranteed. VestBlock improves the path and the follow-up system.</text>
</svg>`;

  await writeFile(path.join(outDir, 'vestblock-growth-flowchart.svg'), svg);
  return path.join(outDir, 'vestblock-growth-flowchart.svg');
}

function flowNode(x, y, step, title, body) {
  return `<g>
    <rect x="${x}" y="${y}" width="265" height="180" rx="28" fill="#0b1320" stroke="#1f4353"/>
    <circle cx="${x + 42}" cy="${y + 44}" r="22" fill="url(#cyan)" filter="url(#glow)"/>
    <text x="${x + 35}" y="${y + 52}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="#041016">${step}</text>
    <text x="${x + 76}" y="${y + 50}" class="label">${title}</text>
    ${wrapSvgText(body, x + 32, y + 94, 34)}
  </g>`;
}

function wrapSvgText(text, x, y, charsPerLine) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= charsPerLine) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * 28}" class="body">${line}</text>`)
    .join('');
}

async function createSalesReadme(files) {
  const content = `# VestBlock Growth Sales Assets

These buyer-ready assets support the Search Visibility and AI Receptionist offers.

## Public files

- [Search Visibility one-pager](/sales/vestblock-search-visibility-one-pager.pdf)
- [AI Receptionist one-pager](/sales/vestblock-ai-receptionist-one-pager.pdf)
- [Before/after growth example](/sales/vestblock-before-after-growth-example.pdf)
- [7-day growth launch plan](/sales/vestblock-7-day-growth-launch-plan.pdf)
- [Growth system flowchart](/sales/vestblock-growth-flowchart.svg)

## How to use them

- Send the one-pager that matches the prospect's pain first.
- Use the before/after example when the buyer understands the problem but not the value.
- Use the 7-day plan when a buyer asks what happens after they submit the form.
- Use the SVG flowchart in posts, proposals, decks, and service pages.

## Compliance notes

- Do not promise rankings, booked calls, revenue, lead volume, PR placements, or AI-search placement.
- Position the services as setup, improvement, and support for clearer visibility and lead capture.
- Keep claims tied to work VestBlock can actually perform: review, planning, page direction, receptionist setup, lead capture, alerts, booking handoff, and launch QA.

Generated files:

${files.map((file) => `- ${file}`).join('\n')}
`;
  const docPath = path.join(process.cwd(), 'docs', 'sales', 'VESTBLOCK_GROWTH_SALES_ASSETS.md');
  await writeFile(docPath, content);
  return docPath;
}

await mkdir(outDir, { recursive: true });
await mkdir(path.join(process.cwd(), 'docs', 'sales'), { recursive: true });

const files = [
  await createSearchVisibilityOnePager(),
  await createAiReceptionistOnePager(),
  await createBeforeAfterPdf(),
  await createSevenDayPlanPdf(),
  await createFlowchartSvg(),
];
const readme = await createSalesReadme(files);

console.log(JSON.stringify({ files, readme }, null, 2));
