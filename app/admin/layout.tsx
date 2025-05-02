import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { BarChart3, Users, FileText, Settings, Home, AlertCircle, Activity, List } from "lucide-react"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard for VestBlock",
}

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check if user is authenticated and is an admin
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect("/login?redirect=/admin")
  }

  // Get user data
  const { data: userData, error: userError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single()

  if (userError || !userData || userData.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        <aside className="w-64 border-r bg-gray-100/40 dark:bg-gray-800/40">
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
              <Link className="flex items-center font-semibold" href="/admin">
                <span className="text-lg font-bold">Admin Dashboard</span>
              </Link>
            </div>
            <nav className="flex-1 overflow-auto py-2">
              <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wide">General</h2>
                <div className="space-y-1">
                  <Link href="/admin">
                    <Button variant="ghost" className="w-full justify-start">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/admin/users">
                    <Button variant="ghost" className="w-full justify-start">
                      <Users className="mr-2 h-4 w-4" />
                      Users
                    </Button>
                  </Link>
                  <Link href="/admin/analyses">
                    <Button variant="ghost" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Analyses
                    </Button>
                  </Link>
                  <Link href="/admin/settings">
                    <Button variant="ghost" className="w-full justify-start">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wide">Monitoring</h2>
                <div className="space-y-1">
                  <Link href="/admin/openai-monitoring">
                    <Button variant="ghost" className="w-full justify-start">
                      <Activity className="mr-2 h-4 w-4" />
                      OpenAI Monitoring
                    </Button>
                  </Link>
                  <Link href="/admin/queue-monitor">
                    <Button variant="ghost" className="w-full justify-start">
                      <List className="mr-2 h-4 w-4" />
                      Queue Monitor
                    </Button>
                  </Link>
                  <Link href="/admin/openai-diagnostic">
                    <Button variant="ghost" className="w-full justify-start">
                      <AlertCircle className="mr-2 h-4 w-4" />
                      OpenAI Diagnostic
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wide">Navigation</h2>
                <div className="space-y-1">
                  <Link href="/dashboard">
                    <Button variant="ghost" className="w-full justify-start">
                      <Home className="mr-2 h-4 w-4" />
                      Back to App
                    </Button>
                  </Link>
                </div>
              </div>
            </nav>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
