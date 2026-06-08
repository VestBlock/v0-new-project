import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'public', 'proof', 'visibility');
const docsDir = path.join(root, 'docs', 'content');
const reportPath = path.join(docsDir, 'VESTBLOCK_VISIBILITY_PROOF_ASSETS.md');

const pages = [
  {
    label: 'Visibility Case Study',
    slug: 'visibility-case-study',
    url: 'https://www.vestblock.io/visibility-expansion/case-study',
  },
  {
    label: 'Visibility Proof Hub',
    slug: 'visibility-proof-hub',
    url: 'https://www.vestblock.io/visibility-expansion/proof-hub',
  },
  {
    label: 'Search Visibility Service',
    slug: 'search-visibility-service',
    url: 'https://www.vestblock.io/visibility-expansion',
  },
  {
    label: 'DealVault Demo Record',
    slug: 'dealvault-demo-record',
    url: 'https://www.vestblock.io/dealvault/demo-record',
  },
  {
    label: 'AI Receptionist',
    slug: 'ai-receptionist',
    url: 'https://www.vestblock.io/ai-assistant',
  },
  {
    label: 'LLM Feed',
    slug: 'llms-feed',
    url: 'https://www.vestblock.io/llms.txt',
  },
  {
    label: 'Sitemap',
    slug: 'sitemap',
    url: 'https://www.vestblock.io/sitemap.xml',
  },
  {
    label: 'Newest Learn Page (Trust Proof Checklist)',
    slug: 'learn-trust-proof-checklist',
    url: 'https://www.vestblock.io/learn/website-trust-proof-checklist',
  },
];

const extraProofAssets = [
  { label: 'AIToolsIndex submission success', slug: 'aitoolsindex-submission-success' },
  { label: 'TheToolBus submission success', slug: 'thetoolbus-submission-success' },
  { label: 'Zearches submission success', slug: 'zearches-submission-success' },
  { label: 'SaaSCubes submission success', slug: 'saascubes-submission-success' },
];

const milestones = [
  {
    score: 22,
    label: 'Blocked',
    date: 'May 12, 2026',
    note: 'Production site was not reliably crawlable.',
  },
  {
    score: 54,
    label: 'Restored',
    date: 'May 12, 2026',
    note: 'Production routes, sitemap, robots.txt, and llms.txt returned 200.',
  },
  {
    score: 60,
    label: 'AI-search foundation',
    date: 'May 13, 2026',
    note: 'Exact-match learn pages went live for VestBlock services.',
  },
  {
    score: 63,
    label: 'Proof layer live',
    date: 'May 13, 2026',
    note: 'Case study, proof screenshots, and structured proof language added.',
  },
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function scorecardSvg() {
  const width = 1400;
  const height = 900;
  const maxScore = 100;
  const chartLeft = 130;
  const chartTop = 220;
  const chartWidth = 1060;
  const chartHeight = 360;
  const points = milestones.map((milestone, index) => {
    const x = chartLeft + (chartWidth / (milestones.length - 1)) * index;
    const y = chartTop + chartHeight - (milestone.score / maxScore) * chartHeight;
    return { ...milestone, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">VestBlock Visibility Proof Scorecard</title>
  <desc id="desc">A proof scorecard showing VestBlock visibility progress from blocked to proof layer live.</desc>
  <defs>
    <radialGradient id="orb" cx="20%" cy="15%" r="85%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.42"/>
      <stop offset="45%" stop-color="#0f172a" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <linearGradient id="line" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#facc15"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#orb)"/>
  <g opacity="0.18">
    ${Array.from({ length: 34 }, (_, index) => `<line x1="${index * 44}" x2="${index * 44}" y1="0" y2="${height}" stroke="#e2e8f0" stroke-width="1"/>`).join('')}
    ${Array.from({ length: 22 }, (_, index) => `<line x1="0" x2="${width}" y1="${index * 44}" y2="${index * 44}" stroke="#e2e8f0" stroke-width="1"/>`).join('')}
  </g>
  <text x="86" y="92" fill="#67e8f9" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="700" letter-spacing="0.08em">VESTBLOCK PROOF LOG</text>
  <text x="86" y="150" fill="#ffffff" font-size="54" font-family="Inter, Arial, sans-serif" font-weight="800">Visibility score climbed from 22 to 63</text>
  <text x="88" y="196" fill="#cbd5e1" font-size="24" font-family="Inter, Arial, sans-serif">Live site, sitemap, llms.txt, AI-search pages, and proof case study are now crawlable.</text>
  <line x1="${chartLeft}" y1="${chartTop + chartHeight}" x2="${chartLeft + chartWidth}" y2="${chartTop + chartHeight}" stroke="#64748b" stroke-width="2"/>
  <line x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartTop + chartHeight}" stroke="#64748b" stroke-width="2"/>
  <polyline points="${linePoints}" fill="none" stroke="url(#line)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  ${points.map((point) => `
    <g>
      <circle cx="${point.x}" cy="${point.y}" r="18" fill="#020617" stroke="#67e8f9" stroke-width="6"/>
      <text x="${point.x - 26}" y="${point.y - 34}" fill="#ffffff" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">${point.score}/100</text>
      <rect x="${point.x - 108}" y="${chartTop + chartHeight + 34}" width="216" height="132" rx="22" fill="#0f172a" stroke="#334155"/>
      <text x="${point.x - 88}" y="${chartTop + chartHeight + 72}" fill="#f8fafc" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(point.label)}</text>
      <text x="${point.x - 88}" y="${chartTop + chartHeight + 104}" fill="#67e8f9" font-size="17" font-family="Inter, Arial, sans-serif">${escapeXml(point.date)}</text>
      <foreignObject x="${point.x - 88}" y="${chartTop + chartHeight + 118}" width="176" height="58">
        <p xmlns="http://www.w3.org/1999/xhtml" style="margin:0;color:#cbd5e1;font:14px Arial;line-height:1.25">${escapeXml(point.note)}</p>
      </foreignObject>
    </g>
  `).join('')}
  <rect x="86" y="760" width="1228" height="76" rx="26" fill="#082f49" stroke="#155e75"/>
  <text x="124" y="808" fill="#e0f2fe" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="700">Next proof target: videos, off-site mentions, directory listings, partner links, and weekly screenshots.</text>
</svg>`;
}

function parseExistingReport(source) {
  if (!source) return null;
  const scoreMatch = source.match(/- Current readiness estimate:\s*(\d{1,3})\/100/i);
  const improvedMatch = source.match(/- What improved:\s*([^\n]+)/i);
  const stillMovesMatch = source.match(/- What still moves the score:\s*([^\n]+)/i);

  return {
    currentScore: scoreMatch ? Number(scoreMatch[1]) : null,
    whatImproved: improvedMatch ? improvedMatch[1].trim() : null,
    whatStillMoves: stillMovesMatch ? stillMovesMatch[1].trim() : null,
  };
}

function titleFromFileName(fileName) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function markdownReport({ captures, existing, captureNote, fileAssets }) {
  const currentScore = existing?.currentScore ?? 63;
  const whatImproved =
    existing?.whatImproved ??
    'production access, sitemap, robots.txt, llms.txt, exact-match learn pages, case study, FAQ schema, and screenshot proof assets.';
  const whatStillMoves =
    existing?.whatStillMoves ??
    'off-site mentions, videos, partner links, indexing evidence, and recurring public score updates.';

  const lines = [
    '# VestBlock Visibility Proof Assets',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Current Proof Score',
    '',
    `- Current readiness estimate: ${currentScore}/100`,
    `- What improved: ${whatImproved}`,
    `- What still moves the score: ${whatStillMoves}`,
    ...(captureNote ? ['', '## Capture Notes', '', `- ${captureNote}`] : []),
    '',
    '## Generated Assets',
    '',
    '- Scorecard graphic: `/proof/visibility/vestblock-visibility-scorecard.svg`',
    ...fileAssets.map((asset) => `- ${asset.label}: \`/proof/visibility/${asset.fileName}\``),
    '',
    '## Usage',
    '',
    '- Add the scorecard graphic to founder posts, pitch deck updates, visibility sales PDFs, and case study updates.',
    '- Use the screenshots as proof that VestBlock can document a before-and-after visibility process.',
    '- Re-run `npm run visibility:proof-assets` after important website, YouTube, PR, or backlink milestones.',
  ];

  return `${lines.join('\n')}\n`;
}

async function httpStatus(url) {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    return response.status;
  } catch (error) {
    const cause = error?.cause;
    const code = cause?.code || error?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      return null;
    }
    return null;
  }
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(docsDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'vestblock-visibility-scorecard.svg'), scorecardSvg(), 'utf8');

let captures = [];
let captureNote = null;

try {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 1 });

  try {
    for (const item of pages) {
      const response = await page.goto(item.url, { waitUntil: 'networkidle', timeout: 45000 });
      const status = response?.status() || 0;
      if (status < 200 || status >= 400) {
        throw new Error(`${item.label} returned HTTP ${status}`);
      }
      const fileName = `${item.slug}.png`;
      await page.screenshot({
        path: path.join(outputDir, fileName),
        fullPage: item.slug !== 'sitemap' && item.slug !== 'llms-feed',
      });
      captures.push({ ...item, fileName, status });
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  const message = String(error?.message || error || 'unknown error').split('\n')[0].trim();
  captureNote = `Playwright screenshot capture failed in this sandbox (${message}). Reused existing screenshots in /public/proof/visibility instead.`;
}

if (captures.length === 0) {
  const statuses = await Promise.all(pages.map((item) => httpStatus(item.url)));
  const networkUnavailable = statuses.every((status) => status == null);

  if (networkUnavailable) {
    captureNote = captureNote
      ? `${captureNote} Network access is unavailable in this environment (DNS lookup failed), so HTTP checks were skipped.`
      : 'Network access is unavailable in this environment (DNS lookup failed), so HTTP checks and screenshots were skipped. Reused existing screenshots in /public/proof/visibility instead.';
    captures = pages.map((item) => ({ ...item, fileName: `${item.slug}.png`, status: null }));
  } else {
    captures = pages.map((item, index) => ({ ...item, fileName: `${item.slug}.png`, status: statuses[index] }));
    for (const capture of captures) {
      const status = capture.status;
      if (typeof status === 'number' && (status < 200 || status >= 400)) {
        throw new Error(`${capture.label} returned HTTP ${status}`);
      }
    }
  }
}

let existingReport = null;
try {
  const reportText = await fs.readFile(reportPath, 'utf8');
  existingReport = parseExistingReport(reportText);
} catch {
  existingReport = null;
}

const knownLabelByFileName = new Map();
for (const item of pages) knownLabelByFileName.set(`${item.slug}.png`, item.label);
for (const item of extraProofAssets) knownLabelByFileName.set(`${item.slug}.png`, item.label);

const outputFiles = await fs.readdir(outputDir);
const pngFiles = outputFiles.filter((file) => file.toLowerCase().endsWith('.png')).sort();
const fileAssets = pngFiles.map((fileName) => ({
  fileName,
  label: knownLabelByFileName.get(fileName) ?? titleFromFileName(fileName),
}));

await fs.writeFile(
  reportPath,
  markdownReport({ captures, existing: existingReport, captureNote, fileAssets }),
  'utf8'
);

console.log(
  JSON.stringify(
    {
      status: 'ok',
      scorecard: 'public/proof/visibility/vestblock-visibility-scorecard.svg',
      screenshots: fileAssets.map((asset) => `public/proof/visibility/${asset.fileName}`),
      report: 'docs/content/VESTBLOCK_VISIBILITY_PROOF_ASSETS.md',
      captureMode: captureNote ? 'http-only' : 'playwright',
    },
    null,
    2
  )
);
