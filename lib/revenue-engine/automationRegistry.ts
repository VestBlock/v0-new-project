import type { AutomationRegistryEntry, AutomationRegistrySnapshot } from './types'

export const AUTOMATION_AUDIT_VERIFIED_AT = '2026-08-10T22:30:00.000Z'

export const AUTOMATION_REGISTRY: AutomationRegistryEntry[] = [
  {
    id: 'vercel-command-center-autopilot', name: 'Command Center autopilot', lane: 'control_plane', surface: 'vercel', schedule: 'Every 4 hours', owner: 'Revenue / CTO', actionClass: 'queue', riskClass: 'yellow', approval: 'policy_gated', disposition: 'modernize', status: 'active', sourceOfTruth: 'vercel.json + command_center_jobs', rollback: 'Disable the Vercel schedule and retain the route in dry-run mode.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'vercel-boss-daily-loop', name: 'Boss daily loop', lane: 'control_plane', surface: 'vercel', schedule: '14:00, 17:00, 20:00, 23:00 UTC', owner: 'CEO / Revenue', actionClass: 'queue', riskClass: 'yellow', approval: 'policy_gated', disposition: 'merge', status: 'active', sourceOfTruth: 'vercel.json + boss-daily-loop route', rollback: 'Disable the Vercel schedule; keep reporting available manually.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'launchd-dealmachine-export-watcher', name: 'DealMachine export watcher', lane: 'deals', surface: 'launchd', schedule: 'Every 15 minutes', owner: 'Acquisitions / CTO', actionClass: 'queue', riskClass: 'green', approval: 'automatic', disposition: 'modernize', status: 'active', sourceOfTruth: 'io.vestblock.dealmachine-export-watcher', rollback: 'Unload the LaunchAgent; preserve cursor, exports, and ingestion history.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'launchd-distress-stack', name: 'Distress stack daily', lane: 'deals', surface: 'launchd', schedule: 'Daily 07:05 local', owner: 'Acquisitions / CTO', actionClass: 'queue', riskClass: 'green', approval: 'automatic', disposition: 'modernize', status: 'blocked', sourceOfTruth: 'io.vestblock.distress-stack', rollback: 'Restore prior host/path configuration and reload the LaunchAgent.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'launchd-on-market-creative', name: 'On-market creative daily', lane: 'deals', surface: 'launchd', schedule: 'Daily 09:15 local', owner: 'Acquisitions', actionClass: 'send', riskClass: 'yellow', approval: 'policy_gated', disposition: 'modernize', status: 'attention', sourceOfTruth: 'io.vestblock.on-market-creative-daily', rollback: 'Keep send flag off and reload the prior LaunchAgent only after owner review.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'launchd-public-distress', name: 'Public distress daily', lane: 'deals', surface: 'launchd', schedule: 'Daily 08:30 local', owner: 'Acquisitions / CTO', actionClass: 'queue', riskClass: 'green', approval: 'automatic', disposition: 'modernize', status: 'attention', sourceOfTruth: 'io.vestblock.public-distress-daily', rollback: 'Reload the prior LaunchAgent after correcting its failing runner.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-dealmachine-stack-expansion', name: 'DealMachine stack expansion', lane: 'deals', surface: 'codex', schedule: 'Daily 08:15 local', owner: 'Acquisitions', actionClass: 'queue', riskClass: 'green', approval: 'automatic', disposition: 'merge', status: 'active', sourceOfTruth: '~/.codex/automations/dealmachine-daily-stack-expansion', rollback: 'Pause the replacement and re-enable the stored Codex automation definition.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-boss-report', name: 'Boss morning report', lane: 'control_plane', surface: 'codex', schedule: 'Every 4 hours', owner: 'CEO', actionClass: 'read', riskClass: 'green', approval: 'automatic', disposition: 'merge', status: 'active', sourceOfTruth: '~/.codex/automations/vestblock-boss-morning-report', rollback: 'Re-enable the Codex report task; no external action reconciliation required.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-daily-strategy-lab', name: 'Daily strategy lab', lane: 'control_plane', surface: 'codex', schedule: 'Daily 08:10 local', owner: 'Revenue', actionClass: 'send', riskClass: 'yellow', approval: 'policy_gated', disposition: 'modernize', status: 'active', sourceOfTruth: '~/.codex/automations/vestblock-daily-strategy-lab', rollback: 'Pause the task and preserve drafts, send events, and strategy history.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-dealmachine-manual-finder', name: 'DealMachine manual finder', lane: 'deals', surface: 'codex', schedule: 'Every 6 hours', owner: 'Acquisitions', actionClass: 'draft', riskClass: 'green', approval: 'automatic', disposition: 'merge', status: 'active', sourceOfTruth: '~/.codex/automations/vestblock-dealmachine-manual-finder-loop', rollback: 'Re-enable the prior finder definition and reconcile its last cursor.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-linkedin-network', name: 'LinkedIn network review', lane: 'partners', surface: 'codex', schedule: 'Every 8 hours', owner: 'Growth / Partners', actionClass: 'draft', riskClass: 'green', approval: 'automatic', disposition: 'modernize', status: 'active', sourceOfTruth: '~/.codex/automations/vestblock-linkedin-network-loop', rollback: 'Re-enable the draft-only task; no LinkedIn action is automated.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-sms-review', name: 'SMS review queue', lane: 'deals', surface: 'codex', schedule: 'Every 6 hours', owner: 'Revenue', actionClass: 'draft', riskClass: 'green', approval: 'automatic', disposition: 'keep', status: 'active', sourceOfTruth: '~/.codex/automations/vestblock-sms-review-queue', rollback: 'Re-enable the review-only task; live SMS remains human-gated.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-website-qa', name: 'Website QA and security', lane: 'control_plane', surface: 'codex', schedule: 'Daily 07:15 local', owner: 'CTO / QA', actionClass: 'control', riskClass: 'green', approval: 'automatic', disposition: 'keep', status: 'active', sourceOfTruth: '~/.codex/automations/vestblock-website-qa-security-loop', rollback: 'Pause the task; preserve its findings and code history.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-bank-owned-targets', name: 'Bank-owned asset target builder', lane: 'deals', surface: 'codex', schedule: 'Paused', owner: 'Acquisitions', actionClass: 'draft', riskClass: 'green', approval: 'automatic', disposition: 'archive', status: 'paused', sourceOfTruth: '~/.codex/automations/bank-owned-asset-target-builder', rollback: 'Re-enable the preserved definition.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-authority-engine', name: 'Daily authority engine', lane: 'growth', surface: 'codex', schedule: 'Paused', owner: 'Growth', actionClass: 'draft', riskClass: 'green', approval: 'automatic', disposition: 'merge', status: 'paused', sourceOfTruth: '~/.codex/automations/vestblock-daily-authority-engine', rollback: 'Re-enable the preserved definition.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-pr-backlink', name: 'Daily PR and backlink sprint', lane: 'growth', surface: 'codex', schedule: 'Paused', owner: 'Growth', actionClass: 'draft', riskClass: 'green', approval: 'automatic', disposition: 'archive', status: 'paused', sourceOfTruth: '~/.codex/automations/vestblock-daily-pr-backlink-sprint', rollback: 'Re-enable the preserved definition.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'codex-landbank-send', name: 'Landbank REO relationship campaign', lane: 'partners', surface: 'codex', schedule: 'Paused', owner: 'Partners', actionClass: 'send', riskClass: 'yellow', approval: 'human_required', disposition: 'modernize', status: 'paused', sourceOfTruth: '~/.codex/automations/vestblock-landbank-reo-daily-send', rollback: 'Keep paused; restore only after shared outreach policy review.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'webhook-paypal-verified', name: 'PayPal verified webhook', lane: 'protected_platform', surface: 'webhook', schedule: 'Event-driven', owner: 'CTO / Finance', actionClass: 'payment', riskClass: 'red', approval: 'human_required', disposition: 'keep', status: 'active', sourceOfTruth: 'app/api/webhook/route.ts', rollback: 'Restore the verified callback and replay only by stable PayPal event IDs.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'webhook-paypal-legacy', name: 'PayPal legacy webhook', lane: 'protected_platform', surface: 'webhook', schedule: 'Event-driven; caller unverified', owner: 'CTO / Finance', actionClass: 'payment', riskClass: 'red', approval: 'human_required', disposition: 'replace', status: 'attention', sourceOfTruth: 'app/api/paypal-webhook/route.ts', rollback: 'Retain route until callback, event parity, signature, and idempotency proof complete.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'webhook-dealmachine', name: 'DealMachine verified webhook', lane: 'deals', surface: 'webhook', schedule: 'Event-driven', owner: 'Acquisitions / CTO', actionClass: 'queue', riskClass: 'yellow', approval: 'policy_gated', disposition: 'keep', status: 'active', sourceOfTruth: 'app/api/webhooks/dealmachine/route.ts', rollback: 'Restore callback and reconcile by persisted provider event ID.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
  {
    id: 'inngest-growth-service', name: 'Growth service workflow', lane: 'growth', surface: 'inngest', schedule: 'Event-driven', owner: 'Growth / CTO', actionClass: 'queue', riskClass: 'green', approval: 'automatic', disposition: 'keep', status: 'unknown', sourceOfTruth: 'lib/inngest/serviceRequestWorkflow.ts', rollback: 'Use the existing direct fallback while preserving the request ID.', verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
  },
]

export function buildAutomationRegistrySnapshot(): AutomationRegistrySnapshot {
  const count = (status: AutomationRegistryEntry['status']) => AUTOMATION_REGISTRY.filter((item) => item.status === status).length
  const risk = (riskClass: AutomationRegistryEntry['riskClass']) => AUTOMATION_REGISTRY.filter((item) => item.riskClass === riskClass).length
  return {
    verifiedAt: AUTOMATION_AUDIT_VERIFIED_AT,
    inventoryTotal: 363,
    classifications: { keep: 135, modernize: 157, merge: 51, archive: 20, replace: 0, remove: 0 },
    registeredSchedulers: AUTOMATION_REGISTRY.length,
    active: count('active'),
    paused: count('paused'),
    blocked: count('blocked'),
    attention: count('attention'),
    green: risk('green'),
    yellow: risk('yellow'),
    red: risk('red'),
    entries: AUTOMATION_REGISTRY,
  }
}
