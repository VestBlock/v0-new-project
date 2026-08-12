import assert from 'node:assert/strict';

import { allocateAttribution } from '../lib/crm/attribution';
import { crmIdempotencyKey, crmIdentityKey, normalizeEmail, normalizePhone } from '../lib/crm/identity';
import { evaluateOutreachEnrollment, resolveChannelPermission } from '../lib/crm/outreach-guard';

const secret = 'test-only-secret-that-is-longer-than-thirty-two-characters';

assert.equal(normalizeEmail('  PERSON@Example.COM '), 'person@example.com');
assert.equal(normalizePhone('(414) 555-0123'), '+14145550123');
assert.equal(crmIdentityKey({ email: 'person@example.com', secret }), crmIdentityKey({ email: ' PERSON@EXAMPLE.COM ', secret }));
assert.notEqual(crmIdentityKey({ email: 'a@example.com', secret }), crmIdentityKey({ email: 'b@example.com', secret }));

const enrollmentKey = crmIdempotencyKey('enrollment', ['campaign-1', 'contact-1'], secret);
assert.equal(enrollmentKey, crmIdempotencyKey('enrollment', ['campaign-1', 'contact-1'], secret));

const permission = resolveChannelPermission([
  { status: 'allowed', observedAt: '2026-08-10T00:00:00.000Z' },
  { status: 'unsubscribed', observedAt: '2026-08-09T00:00:00.000Z' },
]);
assert.equal(permission.status, 'unsubscribed');

const blocked = evaluateOutreachEnrollment({
  permissionHistory: [{ status: 'complaint', observedAt: '2026-08-10T00:00:00.000Z' }],
  idempotencyKey: enrollmentKey,
  existingIdempotencyKeys: new Set([enrollmentKey]),
  approvalGranted: false,
  qualificationEvidenceCount: 0,
});
assert.equal(blocked.allowed, false);
assert.deepEqual(blocked.reasons, [
  'channel_complaint',
  'permission_not_established',
  'duplicate_enrollment',
  'launch_approval_not_granted',
  'qualification_evidence_missing',
]);

const permitted = evaluateOutreachEnrollment({
  permissionHistory: [{ status: 'allowed', observedAt: '2026-08-10T00:00:00.000Z' }],
  idempotencyKey: enrollmentKey,
  existingIdempotencyKeys: new Set(),
  approvalGranted: true,
  qualificationEvidenceCount: 2,
});
assert.equal(permitted.allowed, true);

const credits = allocateAttribution([
  { id: 'a', channel: 'organic_search', occurredAt: '2026-08-01T00:00:00.000Z' },
  { id: 'b', channel: 'email', occurredAt: '2026-08-02T00:00:00.000Z' },
  { id: 'c', channel: 'referral', occurredAt: '2026-08-03T00:00:00.000Z' },
], 'position_based');
assert.equal(credits.reduce((sum, touch) => sum + touch.credit, 0), 1);
assert.deepEqual(credits.map((touch) => touch.credit), [0.4, 0.2, 0.4]);

console.log('CRM identity, suppression, idempotency, and attribution tests passed.');
