"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function AuthStatusChecker() {
  const { user, session, isLoading, isAuthenticated } = useAuth()
  const [sessionCookie, setSessionCookie] = useState<string | null>(null)
  const [isCheckingCookie, setIsCheckingCookie] = useState(true)

  useEffect(() => {
    setIsCheckingCookie(true)
    const allCookies = document.cookie
    const supabaseCookie = allCookies.split(";").find((c) => c.trim().startsWith("sb-"))
    setSessionCookie(supabaseCookie || "Not Found")
    setIsCheckingCookie(false)
  }, [session])

  const handleRecheck = () => {
    window.location.reload()
  }

  return (
    <Card className="bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Authentication Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="font-medium">Auth Context Loading:</span>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Badge variant="success">Finished</Badge>}
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium">Is Authenticated:</span>
          <Badge variant={isAuthenticated ? "success" : "destructive"}>{isAuthenticated ? "Yes" : "No"}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium">User Object:</span>
          <Badge variant={user ? "success" : "destructive"}>{user ? "Exists" : "Null"}</Badge>
        </div>
        {user && (
          <div className="pl-6 text-sm text-muted-foreground">
            <p>ID: {user.id}</p>
            <p>Email: {user.email}</p>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-medium">Session Object:</span>
          <Badge variant={session ? "success" : "destructive"}>{session ? "Exists" : "Null"}</Badge>
        </div>
        {session && (
          <div className="pl-6 text-sm text-muted-foreground">
            <p>Expires In: {session.expires_in}s</p>
            <p>Access Token: {session.access_token.substring(0, 20)}...</p>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-medium">Supabase Cookie:</span>
          {isCheckingCookie ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Badge variant={sessionCookie !== "Not Found" ? "success" : "destructive"}>
              {sessionCookie !== "Not Found" ? "Found" : "Not Found"}
            </Badge>
          )}
        </div>
        <Button onClick={handleRecheck} variant="outline" className="w-full bg-transparent">
          Re-check Status
        </Button>
      </CardContent>
    </Card>
  )
}
