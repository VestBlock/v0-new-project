"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function AuthDebug() {
  const [authState, setAuthState] = useState<any>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionChecks, setSessionChecks] = useState<any[]>([])
  const supabase = getSupabaseClient()
  const router = useRouter()

  // Automatically check auth state when component mounts
  useEffect(() => {
    if (isVisible) {
      checkAuthState()
    }
  }, [isVisible])

  const checkAuthState = async () => {
    setIsLoading(true)
    try {
      // Get session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      // Get user
      const { data: userData, error: userError } = await supabase.auth.getUser()

      // Check cookies
      const cookies = document.cookie.split(";").reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split("=")
          acc[key] = value
          return acc
        },
        {} as Record<string, string>,
      )

      // Check localStorage
      const localStorageItems = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          try {
            localStorageItems[key] = localStorage.getItem(key)
          } catch (e) {
            localStorageItems[key] = "Error reading value"
          }
        }
      }

      const newCheck = {
        session: sessionData,
        sessionError: sessionError?.message,
        user: userData,
        userError: userError?.message,
        cookies,
        localStorage: localStorageItems,
        timestamp: new Date().toISOString(),
      }

      setSessionChecks((prev) => [newCheck, ...prev])
      setAuthState(newCheck)
    } catch (error) {
      console.error("Auth debug error:", error)
      setAuthState({ error: String(error) })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      setAuthState({ message: "Signed out successfully" })

      // Clear any bypass flags
      localStorage.removeItem("bypass_auth")
      localStorage.removeItem("admin_bypass")

      // Clear cookies
      document.cookie = "bypass_auth=; path=/; max-age=0"
      document.cookie = "admin_bypass=; path=/; max-age=0"

      setTimeout(() => {
        window.location.href = "/login"
      }, 1000)
    } catch (error) {
      console.error("Sign out error:", error)
      setAuthState({ error: String(error) })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBypassAuth = () => {
    // Set a local storage flag to bypass auth checks
    localStorage.setItem("bypass_auth", "true")
    document.cookie = "bypass_auth=true; path=/; max-age=3600"
    window.location.reload()
  }

  const handleForceRedirect = (path: string) => {
    router.push(path)
  }

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="fixed bottom-4 left-4 opacity-50 hover:opacity-100"
        onClick={() => setIsVisible(true)}
      >
        Auth Debug
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 left-4 p-4 z-50 w-96 bg-card/90 backdrop-blur max-h-[80vh] overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Auth Debug</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)}>
          Close
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={checkAuthState} disabled={isLoading} className="flex-1">
            Check Auth State
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut} disabled={isLoading} className="flex-1">
            Force Sign Out
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={handleBypassAuth} className="flex-1">
            Bypass Auth
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleForceRedirect("/chat")} className="flex-1">
            Go to Chat
          </Button>
        </div>

        {authState && (
          <div className="mt-4 text-xs">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Current Auth State</h4>
              <span className="text-muted-foreground">{new Date(authState.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="bg-muted p-2 rounded overflow-auto max-h-[200px]">
              <pre>
                {JSON.stringify(
                  {
                    isAuthenticated: !!authState.session?.session,
                    user: authState.user?.user?.email,
                    bypassAuth: authState.cookies?.bypass_auth === "true",
                    adminBypass: authState.cookies?.admin_bypass === "true",
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            <details className="mt-2">
              <summary className="cursor-pointer">Full Details</summary>
              <pre className="bg-muted p-2 rounded overflow-auto max-h-[300px] mt-2">
                {JSON.stringify(authState, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {sessionChecks.length > 1 && (
          <details className="mt-2">
            <summary className="cursor-pointer">Session History ({sessionChecks.length - 1} previous checks)</summary>
            <div className="space-y-2 mt-2">
              {sessionChecks.slice(1).map((check, i) => (
                <details key={i} className="text-xs">
                  <summary className="cursor-pointer">
                    {new Date(check.timestamp).toLocaleTimeString()} -
                    {check.user?.user ? ` ${check.user.user.email}` : " Not authenticated"}
                  </summary>
                  <pre className="bg-muted p-2 rounded overflow-auto max-h-[200px] mt-1">
                    {JSON.stringify(check, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          </details>
        )}
      </div>
    </Card>
  )
}
