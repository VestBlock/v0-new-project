const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isSameOriginMutation(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return false;
  }

  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
