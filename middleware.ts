import { NextResponse, type NextRequest } from 'next/server';

const protectedAdminPages = [
  '/admin',
  '/admin-panel',
  '/admin/test',
];

const protectedAuthenticatedPages = [
  '/analysis/results',
  '/chat',
  '/credit-dashboard',
  '/credit-upload',
  '/dashboard',
  '/profile',
  '/roadmap',
  '/super-dispute',
  '/tools/business-credit',
  '/tools/dispute-letters',
  '/tools/grants',
  '/tools/my-dispute-letters',
  '/user-hub',
];

const protectedDiagnostics = [
  '/auth-debug',
  '/credit-report-diagnostic',
  '/database-diagnostic',
  '/setup-database',
];

const protectedDiagnosticApis = [
  '/api/execute-sql',
  '/api/run-db-setup',
  '/api/setup-database',
  '/api/test-openai-connection',
];

function diagnosticsEnabled() {
  return process.env.ENABLE_INTERNAL_DIAGNOSTICS === 'true' || process.env.NODE_ENV !== 'production';
}

type SupabaseUser = {
  id: string;
  email?: string | null;
};

function matchProtectedPath(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function matchesProtectedPath(pathname: string) {
  return (
    matchProtectedPath(pathname, protectedAdminPages) ||
    matchProtectedPath(pathname, protectedAuthenticatedPages) ||
    matchProtectedPath(pathname, protectedDiagnostics) ||
    matchProtectedPath(pathname, protectedDiagnosticApis)
  );
}

function isProtectedApi(pathname: string) {
  return matchProtectedPath(pathname, protectedDiagnosticApis);
}

function isDiagnosticPath(pathname: string) {
  return (
    matchProtectedPath(pathname, protectedDiagnostics) ||
    matchProtectedPath(pathname, protectedDiagnosticApis)
  );
}

function requiresAdmin(pathname: string) {
  return (
    matchProtectedPath(pathname, protectedAdminPages) ||
    matchProtectedPath(pathname, protectedDiagnostics) ||
    matchProtectedPath(pathname, protectedDiagnosticApis)
  );
}

function shouldNoIndex(pathname: string) {
  return (
    matchProtectedPath(pathname, protectedAdminPages) ||
    matchProtectedPath(pathname, protectedAuthenticatedPages) ||
    matchProtectedPath(pathname, protectedDiagnostics)
  );
}

function withNoIndex(response: NextResponse, pathname: string) {
  if (shouldNoIndex(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  return response;
}

function configuredAdminEmails() {
  return [process.env.ADMIN_ALERT_EMAIL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return { supabaseUrl, anonKey };
}

function getSupabaseRef(supabaseUrl: string) {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  return atob(padded);
}

function getCookieValue(request: NextRequest, cookieName: string) {
  const direct = request.cookies.get(cookieName)?.value;
  if (direct) return direct;

  const chunks = request.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith(`${cookieName}.`))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cookie) => cookie.value);

  return chunks.length > 0 ? chunks.join('') : null;
}

function extractAccessTokenFromCookie(rawValue: string | null) {
  if (!rawValue) return null;

  try {
    const decoded = decodeURIComponent(rawValue);
    const sessionJson = decoded.startsWith('base64-')
      ? decodeBase64Url(decoded.slice('base64-'.length))
      : decoded;
    const parsed = JSON.parse(sessionJson);

    if (typeof parsed?.access_token === 'string') {
      return parsed.access_token;
    }

    if (typeof parsed?.currentSession?.access_token === 'string') {
      return parsed.currentSession.access_token;
    }

    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return parsed[0];
    }
  } catch {
    return null;
  }

  return null;
}

function getSupabaseAccessToken(request: NextRequest, supabaseUrl: string) {
  const projectRef = getSupabaseRef(supabaseUrl);
  if (!projectRef) return null;

  return extractAccessTokenFromCookie(
    getCookieValue(request, `sb-${projectRef}-auth-token`)
  );
}

async function getUserFromToken(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string
): Promise<SupabaseUser | null> {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return null;

  const user = await response.json().catch(() => null);
  if (!user?.id) return null;

  return { id: user.id, email: user.email };
}

async function getUserProfileRole(input: {
  supabaseUrl: string;
  anonKey: string;
  accessToken: string;
  user: SupabaseUser;
}) {
  const filters = [
    `id.eq.${input.user.id}`,
    `user_id.eq.${input.user.id}`,
    input.user.email && `email.eq.${input.user.email}`,
  ]
    .filter(Boolean)
    .join(',');

  const url = new URL('/rest/v1/user_profiles', input.supabaseUrl);
  url.searchParams.set('select', 'role');
  url.searchParams.set('or', `(${filters})`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      apikey: input.anonKey,
      Authorization: `Bearer ${input.accessToken}`,
    },
  });

  if (!response.ok) return null;

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0]?.role ?? null : null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!matchesProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const adminRequest = requiresAdmin(pathname);
  const apiRequest = isProtectedApi(pathname);
  const config = getSupabaseConfig();
  const accessToken = config
    ? getSupabaseAccessToken(request, config.supabaseUrl)
    : null;

  const user =
    config && accessToken
      ? await getUserFromToken(config.supabaseUrl, config.anonKey, accessToken)
      : null;

  if (!user) {
    if (apiRequest) {
      return withNoIndex(
        NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
        ),
        pathname
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'redirect',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return withNoIndex(NextResponse.redirect(loginUrl), pathname);
  }

  if (!adminRequest) {
    return withNoIndex(NextResponse.next(), pathname);
  }

  const email = user.email?.toLowerCase();
  let isAdmin = Boolean(email && configuredAdminEmails().includes(email));

  if (!isAdmin && config && accessToken) {
    const role = await getUserProfileRole({
      supabaseUrl: config.supabaseUrl,
      anonKey: config.anonKey,
      accessToken,
      user,
    });
    isAdmin = role === 'admin';
  }

  if (!isAdmin) {
    if (apiRequest) {
      return withNoIndex(
        NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 }
        ),
        pathname
      );
    }

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return withNoIndex(NextResponse.redirect(dashboardUrl), pathname);
  }

  if (isDiagnosticPath(pathname) && !diagnosticsEnabled()) {
    return withNoIndex(new NextResponse('Not found', { status: 404 }), pathname);
  }

  return withNoIndex(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    '/analysis/results/:path*',
    '/admin/:path*',
    '/admin-panel/:path*',
    '/admin/test/:path*',
    '/auth-debug/:path*',
    '/chat/:path*',
    '/credit-dashboard/:path*',
    '/credit-report-diagnostic/:path*',
    '/credit-upload/:path*',
    '/database-diagnostic/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/roadmap/:path*',
    '/setup-database/:path*',
    '/super-dispute/:path*',
    '/tools/business-credit/:path*',
    '/tools/dispute-letters/:path*',
    '/tools/grants/:path*',
    '/tools/my-dispute-letters/:path*',
    '/user-hub/:path*',
    '/api/execute-sql/:path*',
    '/api/run-db-setup/:path*',
    '/api/setup-database/:path*',
    '/api/test-openai-connection/:path*',
  ],
};
