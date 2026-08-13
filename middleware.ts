import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { isConfiguredAdminEmail } from '@/lib/auth/admin-emails';
import type { Database } from '@/types/supabase';

const protectedAdminPages = [
  '/admin',
  '/admin-panel',
  '/admin/test',
  '/dev/command-center-preview',
];

const protectedAdminApis = [
  '/api/admin',
];

const protectedAuthenticatedApis = [
  '/api/workspace',
  '/api/chat',
  '/api/chat-with-analysis',
  '/api/generate-roadmap',
  '/api/side-hustle-chat',
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
  '/workspace',
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

function matchProtectedPath(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function matchesProtectedPath(pathname: string) {
  return (
    matchProtectedPath(pathname, protectedAdminPages) ||
    matchProtectedPath(pathname, protectedAdminApis) ||
    matchProtectedPath(pathname, protectedAuthenticatedApis) ||
    matchProtectedPath(pathname, protectedAuthenticatedPages) ||
    matchProtectedPath(pathname, protectedDiagnostics) ||
    matchProtectedPath(pathname, protectedDiagnosticApis)
  );
}

function isProtectedApi(pathname: string) {
  return (
    matchProtectedPath(pathname, protectedAdminApis) ||
    matchProtectedPath(pathname, protectedAuthenticatedApis) ||
    matchProtectedPath(pathname, protectedDiagnosticApis)
  );
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
    matchProtectedPath(pathname, protectedAdminApis) ||
    matchProtectedPath(pathname, protectedDiagnostics) ||
    matchProtectedPath(pathname, protectedDiagnosticApis)
  );
}

function shouldNoIndex(pathname: string) {
  return (
    matchProtectedPath(pathname, protectedAdminPages) ||
    matchProtectedPath(pathname, protectedAdminApis) ||
    matchProtectedPath(pathname, protectedAuthenticatedPages) ||
    matchProtectedPath(pathname, protectedDiagnostics)
  );
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function isSameOriginMutation(request: NextRequest) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true

  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return false
  }

  const origin = request.headers.get('origin')
  if (!origin) return true

  try {
    const originUrl = new URL(origin)
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const expectedHost = forwardedHost || request.headers.get('host') || request.nextUrl.host
    const expectedProtocol = forwardedProto ? `${forwardedProto}:` : request.nextUrl.protocol
    return originUrl.host === expectedHost && originUrl.protocol === expectedProtocol
  } catch {
    return false
  }
}

function withNoIndex(response: NextResponse, pathname: string) {
  if (shouldNoIndex(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  response.headers.set('Origin-Agent-Cluster', '?1')

  return response;
}

function copyAuthCookies(source: NextResponse | null, target: NextResponse) {
  source?.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
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

async function refreshServerAuth(request: NextRequest, config: NonNullable<ReturnType<typeof getSupabaseConfig>>) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.supabaseUrl, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  return { response, supabase, user: user ? { id: user.id, email: user.email } : null };
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!matchesProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const adminRequest = requiresAdmin(pathname);
  const apiRequest = isProtectedApi(pathname);

  if (apiRequest && !isSameOriginMutation(request)) {
    return withNoIndex(
      NextResponse.json(
        { error: 'Cross-site state-changing requests are not allowed.' },
        { status: 403 }
      ),
      pathname
    )
  }

  const config = getSupabaseConfig();
  const auth = config ? await refreshServerAuth(request, config) : null;
  const user = auth?.user ?? null;

  if (!user) {
    if (apiRequest) {
      return copyAuthCookies(auth?.response ?? null, withNoIndex(
        NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
        ),
        pathname
      ));
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'redirect',
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    return copyAuthCookies(auth?.response ?? null, withNoIndex(NextResponse.redirect(loginUrl), pathname));
  }

  if (!adminRequest) {
    return withNoIndex(auth?.response ?? NextResponse.next(), pathname);
  }

  const email = user.email?.toLowerCase();
  let isAdmin = isConfiguredAdminEmail(email);

  if (!isAdmin && auth) {
    const { data: profile } = await auth.supabase
      .from('user_profiles')
      .select('role')
      .or(`id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
      .maybeSingle();
    isAdmin = profile?.role === 'admin';
  }

  if (!isAdmin) {
    if (apiRequest) {
      return copyAuthCookies(auth?.response ?? null, withNoIndex(
        NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 }
        ),
        pathname
      ));
    }

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return copyAuthCookies(auth?.response ?? null, withNoIndex(NextResponse.redirect(dashboardUrl), pathname));
  }

  if (isDiagnosticPath(pathname) && !diagnosticsEnabled()) {
    return copyAuthCookies(auth?.response ?? null, withNoIndex(new NextResponse('Not found', { status: 404 }), pathname));
  }

  return withNoIndex(auth?.response ?? NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    '/analysis/results/:path*',
    '/admin/:path*',
    '/admin-panel/:path*',
    '/admin/test/:path*',
    '/dev/command-center-preview/:path*',
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
    '/workspace/:path*',
    '/api/admin/:path*',
    '/api/chat/:path*',
    '/api/chat-with-analysis/:path*',
    '/api/generate-roadmap/:path*',
    '/api/side-hustle-chat/:path*',
    '/api/execute-sql/:path*',
    '/api/run-db-setup/:path*',
    '/api/setup-database/:path*',
    '/api/test-openai-connection/:path*',
    '/api/workspace/:path*',
  ],
};
