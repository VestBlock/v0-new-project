import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const protectedDiagnostics = [
  "/admin/test",
  "/auth-debug",
  "/credit-report-debug",
  "/credit-report-diagnostic",
  "/database-diagnostic",
  "/debug-analyzer",
  "/setup-database",
  "/test-analysis-debug",
  "/test-document-analysis",
  "/test-openai-simple",
  "/test-streaming",
  "/test-upload",
  "/test-upload-simple",
]

const protectedDiagnosticApis = [
  "/api/execute-sql",
  "/api/run-db-setup",
  "/api/setup-database",
  "/api/test-analysis",
  "/api/test-formdata",
  "/api/test-openai",
  "/api/test-openai-connection",
  "/api/test-openai-simple",
  "/api/test-streaming",
]

function matchesProtectedPath(pathname: string) {
  return [...protectedDiagnostics, ...protectedDiagnosticApis].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

function isProtectedApi(pathname: string) {
  return protectedDiagnosticApis.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

function configuredAdminEmails() {
  return [process.env.ADMIN_ALERT_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: "",
            ...options,
          })
        },
      },
    },
  )

  // Refresh session if expired - important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (matchesProtectedPath(request.nextUrl.pathname)) {
    const apiRequest = isProtectedApi(request.nextUrl.pathname)

    if (!user) {
      if (apiRequest) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 })
      }

      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = "/login"
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }

    const email = user.email?.toLowerCase()
    let isAdmin = Boolean(email && configuredAdminEmails().includes(email))

    if (!isAdmin) {
      const profileFilters = [
        `id.eq.${user.id}`,
        `user_id.eq.${user.id}`,
        user.email && `email.eq.${user.email}`,
      ]
        .filter(Boolean)
        .join(",")

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .or(profileFilters)
        .maybeSingle()

      isAdmin = profile?.role === "admin"
    }

    if (!isAdmin) {
      if (apiRequest) {
        return NextResponse.json({ error: "Admin access required." }, { status: 403 })
      }

      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = "/dashboard"
      dashboardUrl.search = ""
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
