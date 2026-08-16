const GATE3D1_CANARY_MAILBOX_SYNC_PATHNAME = '/api/cron/mailbox-sync';

function gate3d1CanaryIsolationEnabled() {
  return /^(1|true|yes|on)$/i.test(
    String(process.env.GATE3D1_CANARY_ISOLATION || '').trim()
  );
}

function isExactGate3d1CanaryCronPath(request: Request) {
  try {
    return new URL(request.url).pathname === GATE3D1_CANARY_MAILBOX_SYNC_PATHNAME;
  } catch {
    return false;
  }
}

export function isCronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;

  if (
    gate3d1CanaryIsolationEnabled() &&
    (!expected || !isExactGate3d1CanaryCronPath(request))
  ) {
    return false;
  }

  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }

  return request.headers.get('authorization') === `Bearer ${expected}`;
}
