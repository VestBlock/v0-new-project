import { NextResponse, type NextRequest } from 'next/server';

const protectedDiagnostics = [
  '/admin',
  '/admin-panel',
  '/admin/test',
  '/auth-debug',
  '/credit-report-debug',
  '/credit-report-diagnostic',
  '/database-diagnostic',
  '/debug-analyzer',
  '/setup-database',
  '/test-analysis-debug',
  '/test-document-analysis',
  '/test-openai-simple',
  '/test-streaming',
  '/test-upload',
  '/test-upload-simple',
];

const protectedDiagnosticApis = [
  '/api/execute-sql',
  '/api/run-db-setup',
  '/api/setup-database',
  '/api/test-analysis',
  '/api/test-formdata',
  '/api/test-openai',
  '/api/test-openai-connection',
  '/api/test-openai-simple',
  '/api/test-streaming',
];

type SupabaseUser = {
  id: string;
  email?: string | null;
};

function matchesProtectedPath(pathname: string) {
  return [...protectedDiagnostics, ...protectedDiagnosticApis].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isProtectedApi(pathname: string) {
  return protectedDiagnosticApis.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function configuredAdminEmails() {
  return [process.env.ADMIN_ALERT_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
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
  if (!matchesProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const apiRequest = isProtectedApi(request.nextUrl.pathname);
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
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
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
      return NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 }
      );
    }

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/admin-panel/:path*',
    '/admin/test/:path*',
    '/auth-debug/:path*',
    '/credit-report-debug/:path*',
    '/credit-report-diagnostic/:path*',
    '/database-diagnostic/:path*',
    '/debug-analyzer/:path*',
    '/setup-database/:path*',
    '/test-analysis-debug/:path*',
    '/test-document-analysis/:path*',
    '/test-openai-simple/:path*',
    '/test-streaming/:path*',
    '/test-upload/:path*',
    '/test-upload-simple/:path*',
    '/api/execute-sql/:path*',
    '/api/run-db-setup/:path*',
    '/api/setup-database/:path*',
    '/api/test-analysis/:path*',
    '/api/test-formdata/:path*',
    '/api/test-openai/:path*',
    '/api/test-openai-connection/:path*',
    '/api/test-openai-simple/:path*',
    '/api/test-streaming/:path*',
  ],
};
