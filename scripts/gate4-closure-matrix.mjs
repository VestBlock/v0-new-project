#!/usr/bin/env node

import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  }));
  return files.flat();
}

function toRoute(file, marker) {
  const relative = path.relative(path.join(root, marker), file).replaceAll(path.sep, '/');
  return `/${relative.replace(/\/(page|route)\.tsx?$/, '').replace(/^page\.tsx?$/, '')}` || '/';
}

const definitions = {
  '4A': {
    owner: 'Growth & Product',
    purpose: 'Public discovery, education, and conversion entry',
  },
  '4B': {
    owner: 'Identity & Security',
    purpose: 'Authentication, registration, recovery, and account identity',
  },
  '4C': {
    owner: 'Customer Product',
    purpose: 'Authenticated customer tools, records, and dashboards',
  },
  '4D': {
    owner: 'Capital Operations',
    purpose: 'Capital readiness, funding, grants, and financial workflows',
  },
  '4E': {
    owner: 'Deals Operations',
    purpose: 'Deal intake, property intelligence, and partner matching',
  },
  '4F': {
    owner: 'Opportunity Operations',
    purpose: 'Service intake, AI assistance, visibility, and delivery',
  },
  '4G': {
    owner: 'DealVault Operations',
    purpose: 'DealVault records, milestones, proof, and permissions',
  },
  '4H': {
    owner: 'VestBlock Operations',
    purpose: 'Admin, CRM, reporting, approvals, and Command Center',
  },
  '4I': {
    owner: 'Platform Engineering',
    purpose: 'API infrastructure, jobs, webhooks, diagnostics, and scheduled operations',
  },
};

const pageRules = [
  ['4H', /^\/(admin|admin-panel)(\/|$)/],
  ['4G', /^\/dashboard\/dealvault(\/|$)/],
  ['4I', /^\/(auth-debug|database-diagnostic|setup-database|dev)(\/|$)/],
  ['4B', /^\/(affiliates|forgot-password|login|profile|register|reset-password)(\/|$)/],
  ['4C', /^\/(analysis|chat|credit-dashboard|credit-report-diagnostic|credit-upload|dashboard|roadmap|super-dispute|tools|user-hub)(\/|$)/],
  ['4A', /^\//],
];

const apiRules = [
  ['4H', /^\/api\/(admin|leads)(\/|$)/],
  ['4G', /^\/api\/dealvault(\/|$)/],
  ['4I', /^\/api\/(capture-order|create-order|cron|execute-sql|health|inngest|paypal-webhook|process-payment|run-db-setup|setup-database|test-openai-connection|webhook|webhooks)(\/|$)/],
  ['4B', /^\/api\/auth(\/|$)/],
  ['4C', /^\/api\/(chat|chat-with-analysis|dispute-letters|documents|generate-letter|generate-pdf|generate-roadmap|initiate-analysis|job-status|upload-credit-report)(\/|$)/],
  ['4D', /^\/api\/(biz-credit|funding|funding-lead|funding-strategy|grants)(\/|$)/],
  ['4E', /^\/api\/(buyers|dashboard\/network-intake|lenders|portal|property-analyzer|property-intelligence|real-estate-lead|sell-lead)(\/|$)/],
  ['4F', /^\/api\/(ai-assistant-request|service-deliverables|service-interest|side-hustle-chat|visibility-expansion-request)(\/|$)/],
  ['4A', /^\/api\/(next-move|site-preview)(\/|$)/],
];

function classify(route, rules, kind) {
  const match = rules.find(([, expression]) => expression.test(route));
  if (!match) throw new Error(`Unassigned ${kind}: ${route}`);
  return match[0];
}

const allFiles = await walk(path.join(root, 'app'));
const pageFiles = allFiles.filter((file) => file.endsWith('/page.tsx')).sort();
const apiFiles = allFiles.filter((file) => file.includes('/app/api/') && file.endsWith('/route.ts')).sort();

const rows = [
  ...pageFiles.map((file) => ({
    kind: 'page',
    route: toRoute(file, 'app'),
    file: path.relative(root, file),
  })),
  ...apiFiles.map((file) => ({
    kind: 'handler',
    route: toRoute(file, 'app'),
    file: path.relative(root, file),
  })),
].map((row) => {
  const gate = classify(row.route, row.kind === 'page' ? pageRules : apiRules, row.kind);
  const definition = definitions[gate];
  return {
    ...row,
    gate,
    owner: definition.owner,
    purpose: definition.purpose,
    status: gate === '4A' ? 'verified_in_gate_4a' : `assigned_to_gate_${gate.toLowerCase()}`,
  };
});

const counts = rows.reduce((result, row) => {
  result[row.gate] = (result[row.gate] ?? 0) + 1;
  return result;
}, {});

const output = {
  generatedAt: new Date().toISOString(),
  totals: {
    pages: pageFiles.length,
    handlers: apiFiles.length,
    items: rows.length,
  },
  gateCounts: Object.fromEntries(Object.keys(definitions).map((gate) => [gate, counts[gate] ?? 0])),
  unassigned: 0,
  rows,
};

if (process.argv.includes('--summary')) {
  console.log(JSON.stringify({
    totals: output.totals,
    gateCounts: output.gateCounts,
    unassigned: output.unassigned,
  }, null, 2));
} else {
  console.log(JSON.stringify(output, null, 2));
}
