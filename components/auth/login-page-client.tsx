"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { buildAuthPath, DEFAULT_AUTH_RETURN_PATH, getSafeAuthReturnPath, normalizeAuthIntent } from "@/lib/auth/intent"

export function LoginPageClient() {
  const defaultRedirectTarget = DEFAULT_AUTH_RETURN_PATH
  const searchParams = useSearchParams()
  const prefilledEmail = searchParams.get("email") || ""
  const [email, setEmail] = useState(() => prefilledEmail)
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { signIn, isLoading, authError, isAuthenticated } = useAuth()
  const router = useRouter()
  const redirectTarget = getSafeAuthReturnPath(
    searchParams.get("next") || searchParams.get("redirect"),
    defaultRedirectTarget
  )
  const intent = normalizeAuthIntent(searchParams.get("intent"))
  const authErrorCode = searchParams.get("auth_error")

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTarget)
    }
  }, [isAuthenticated, redirectTarget, router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const didSignIn = await signIn(email, password)
      if (didSignIn) {
        window.location.assign(redirectTarget)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in to VestBlock</CardTitle>
          <CardDescription>
            Open your network workspace, saved requests, funding tools, and DealVault records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href={buildAuthPath('/forgot-password', { next: redirectTarget, email, intent })} passHref>
                  <Button variant="link" className="ml-auto inline-block text-sm">
                    Forgot your password?
                  </Button>
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {authError ? <p className="text-sm font-medium text-destructive">{authError}</p> : null}
            {!authError && authErrorCode ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {authErrorCode === 'expired_link'
                  ? 'That verification or recovery link has expired. Request a new link and try again.'
                  : 'That authentication link is invalid. Please sign in or request a new link.'}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || (!email && !password && isLoading)}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href={buildAuthPath('/join', { next: redirectTarget, email, intent })}
              passHref
            >
              <Button variant="link" className="p-0">
                Sign up
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
