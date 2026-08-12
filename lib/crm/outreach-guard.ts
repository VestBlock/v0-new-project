export type ChannelPermissionStatus =
  | 'unknown'
  | 'allowed'
  | 'transactional_only'
  | 'suppressed'
  | 'unsubscribed'
  | 'complaint';

export type ChannelPermission = {
  status: ChannelPermissionStatus;
  observedAt: string;
};

const permanentBlocks = new Set<ChannelPermissionStatus>(['suppressed', 'unsubscribed', 'complaint']);

export function resolveChannelPermission(history: ChannelPermission[]) {
  const valid = history
    .filter((entry) => Number.isFinite(Date.parse(entry.observedAt)))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const permanentBlock = valid.find((entry) => permanentBlocks.has(entry.status));
  return permanentBlock || valid[0] || { status: 'unknown' as const, observedAt: new Date(0).toISOString() };
}

export function evaluateOutreachEnrollment(input: {
  permissionHistory: ChannelPermission[];
  idempotencyKey: string;
  existingIdempotencyKeys: Set<string>;
  approvalGranted: boolean;
  qualificationEvidenceCount: number;
}) {
  const permission = resolveChannelPermission(input.permissionHistory);
  const reasons: string[] = [];
  if (permanentBlocks.has(permission.status)) reasons.push(`channel_${permission.status}`);
  if (!['allowed', 'transactional_only'].includes(permission.status)) reasons.push('permission_not_established');
  if (input.existingIdempotencyKeys.has(input.idempotencyKey)) reasons.push('duplicate_enrollment');
  if (!input.approvalGranted) reasons.push('launch_approval_not_granted');
  if (input.qualificationEvidenceCount < 1) reasons.push('qualification_evidence_missing');
  return { allowed: reasons.length === 0, reasons, permission };
}
