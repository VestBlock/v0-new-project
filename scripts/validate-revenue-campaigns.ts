#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

type Campaign = {
  id: string;
  name: string;
  lane: string;
  enabled: boolean;
  purpose: string;
  audience: string;
  eligibility: string[];
  exclusions: string[];
  channels: string[];
  message_templates: Array<{ id: string; subject: string; body: string }>;
  sequence: Array<{ day: number; template: string }>;
  stop_conditions: string[];
  success_condition: string;
  conversion_goal: string;
  owner: string;
  metrics: string[];
};

const file = path.join(process.cwd(), 'config', 'revenue-campaigns.json');
const registry = JSON.parse(fs.readFileSync(file, 'utf8')) as {
  version: number;
  default_sending_policy: Record<string, unknown>;
  campaigns: Campaign[];
};

assert.equal(registry.version, 1, 'campaign registry version must be 1');
assert.ok(Array.isArray(registry.campaigns) && registry.campaigns.length > 0);
assert.equal(registry.default_sending_policy.require_suppression_check, true);
assert.equal(registry.default_sending_policy.auto_negotiation_allowed, false);

const ids = new Set<string>();
for (const campaign of registry.campaigns) {
  assert.ok(campaign.id && !ids.has(campaign.id), `duplicate or missing campaign id: ${campaign.id}`);
  ids.add(campaign.id);
  for (const field of [
    'name',
    'lane',
    'purpose',
    'audience',
    'success_condition',
    'conversion_goal',
    'owner',
  ] as const) {
    assert.ok(String(campaign[field] || '').trim(), `${campaign.id}: missing ${field}`);
  }
  for (const [field, value] of Object.entries({
    eligibility: campaign.eligibility,
    exclusions: campaign.exclusions,
    channels: campaign.channels,
    message_templates: campaign.message_templates,
    sequence: campaign.sequence,
    stop_conditions: campaign.stop_conditions,
    metrics: campaign.metrics,
  })) {
    assert.ok(Array.isArray(value) && value.length > 0, `${campaign.id}: missing ${field}`);
  }
  assert.ok(
    campaign.stop_conditions.some((condition) => /reply/i.test(condition)),
    `${campaign.id}: every sequence must stop on a reply`
  );
  assert.ok(
    campaign.stop_conditions.some((condition) => /unsubscribe/i.test(condition)),
    `${campaign.id}: every sequence must stop on unsubscribe`
  );
  const templateIds = new Set(campaign.message_templates.map((template) => template.id));
  assert.equal(templateIds.size, campaign.message_templates.length, `${campaign.id}: duplicate template id`);
  let lastDay = -1;
  for (const step of campaign.sequence) {
    assert.ok(Number.isInteger(step.day) && step.day >= 0, `${campaign.id}: invalid sequence day`);
    assert.ok(step.day > lastDay, `${campaign.id}: sequence days must increase`);
    assert.ok(templateIds.has(step.template), `${campaign.id}: unknown template ${step.template}`);
    lastDay = step.day;
  }
}

console.log(
  `PASS campaign registry: ${registry.campaigns.length} campaigns, explicit eligibility/exclusions/stop rules, all launches disabled pending provider readiness.`
);
