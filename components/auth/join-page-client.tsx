'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Loader2, ShieldCheck } from 'lucide-react'

import { useAuth } from '@/contexts/auth-context'
import {
  buildAuthPath,
  DEFAULT_AUTH_RETURN_PATH,
  getSafeAuthReturnPath,
  MEMBER_ROLE_OPTIONS,
  normalizeAuthIntent,
  normalizeMemberRoles,
  type MemberRole,
} from '@/lib/auth/intent'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const INTENT_COPY: Record<string, string> = {
  buyer: 'Save your criteria and let VestBlock organize the next steps around it.',
  capital: 'Save your funding objective and continue into the right capital path.',
  questionnaire: 'Keep your assessment progress and open your personalized roadmap.',
  seller: 'Keep your property request connected to one secure VestBlock workspace.',
}

export function JoinPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { signUp, isLoading, authError, isAuthenticated } = useAuth()
  const prefilledEmail = searchParams.get('email') || ''
  const redirectTarget = getSafeAuthReturnPath(
    searchParams.get('next') || searchParams.get('redirect'),
    DEFAULT_AUTH_RETURN_PATH
  )
  const intent = normalizeAuthIntent(searchParams.get('intent'))
  const initialRoles = useMemo(() => {
    const queryRoles = (searchParams.get('roles') || '').split(',')
    const inferredRole = intent && MEMBER_ROLE_OPTIONS.some((option) => option.value === intent)
      ? [intent]
      : []
    return normalizeMemberRoles([...queryRoles, ...inferredRole])
  }, [intent, searchParams])

  const [email, setEmail] = useState(prefilledEmail)
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [roles, setRoles] = useState<MemberRole[]>(initialRoles)
  const [verificationPending, setVerificationPending] = useState(false)

  useEffect(() => {
    if (isAuthenticated) router.replace(redirectTarget)
  }, [isAuthenticated, redirectTarget, router])

  const toggleRole = (role: MemberRole) => {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role]
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await signUp({
      email,
      password,
      fullName,
      memberRoles: roles,
      next: redirectTarget,
      intent,
    })

    if (!result.ok) return
    if (result.verificationRequired) {
      setVerificationPending(true)
      return
    }

    window.location.assign(redirectTarget)
  }

  if (verificationPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-20">
        <Card className="w-full max-w-lg border-primary/20 bg-card/95 shadow-2xl">
          <CardContent className="space-y-5 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-semibold">Verify your email to continue</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              We sent a secure verification link to <strong className="text-foreground">{email}</strong>.
              Open it on this device and VestBlock will return you to the path you selected.
            </p>
            <Button asChild className="w-full">
              <Link href={buildAuthPath('/login', { next: redirectTarget, email, intent, roles })}>
                I already verified—sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div className="space-y-6 pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            One VestBlock account
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Keep every next move connected.
          </h1>
          <p className="max-w-lg text-base leading-7 text-muted-foreground">
            Create one free account for financial roadmaps, capital requests, real estate criteria,
            saved opportunities, and professional partnerships. Add more roles whenever your goals expand.
          </p>
          {intent && INTENT_COPY[intent] ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
              {INTENT_COPY[intent]}
            </div>
          ) : null}
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>Your selections personalize your workspace. They never grant administrative access.</p>
          </div>
        </div>

        <Card className="border-border/70 bg-card/95 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Create your free account</CardTitle>
            <CardDescription>Start with only what VestBlock needs to save and route your request.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input
                    id="full-name"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">What would you like VestBlock to help with?</legend>
                <p className="text-xs text-muted-foreground">Choose one or more. You can update this later.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MEMBER_ROLE_OPTIONS.map((option) => {
                    const selected = roles.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                          selected
                            ? 'border-primary/60 bg-primary/10 text-foreground'
                            : 'border-border/70 bg-background/40 text-muted-foreground hover:border-primary/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={selected}
                          onChange={() => toggleRole(option.value)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{option.label}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {authError ? <p role="alert" className="text-sm font-medium text-destructive">{authError}</p> : null}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create account and continue
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  className="font-medium text-primary hover:underline"
                  href={buildAuthPath('/login', { next: redirectTarget, email, intent, roles })}
                >
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
