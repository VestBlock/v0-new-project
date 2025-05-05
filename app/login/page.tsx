"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-provider"
import { supabase } from "@/lib/supabase-client"

// Simple validation function instead of using zod with react-hook-form
function validateEmail(email: string): string | null {
  if (!email) return "Email is required"
  if (!/\S+@\S+\.\S+/.test(email)) return "Please enter a valid email address"
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return "Password is required"
  return null
}

export default function LoginPage() {
  // Form state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
  const [emailToConfirm, setEmailToConfirm] = useState("")
  const [resendingEmail, setResendingEmail] = useState(false)

  // Hooks
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo") || "/dashboard"
  const { signIn, user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    setIsMounted(true)
    if (user) {
      router.push(returnTo)
    }
  }, [user, router, returnTo])

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {}

    const emailError = validateEmail(email)
    if (emailError) newErrors.email = emailError

    const passwordError = validatePassword(password)
    if (passwordError) newErrors.password = passwordError

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setNeedsEmailConfirmation(false)
    setEmailToConfirm("")

    try {
      const { error } = await signIn(email, password)

      if (error) {
        // Check if this is an email confirmation error
        if (error.message?.includes("Email not confirmed")) {
          setNeedsEmailConfirmation(true)
          setEmailToConfirm(email)
          toast({
            variant: "warning",
            title: "Email not confirmed",
            description: "Please check your inbox and confirm your email before logging in.",
          })
        } else {
          throw error
        }
      } else {
        toast({
          title: "Login successful",
          description: "Welcome back to VestBlock!",
        })
        router.push(returnTo)
      }
    } catch (error) {
      console.error("Login error:", error)
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "Invalid email or password. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Resend confirmation email
  const resendConfirmationEmail = async () => {
    if (!emailToConfirm) return

    setResendingEmail(true)
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailToConfirm,
      })

      if (error) throw error

      toast({
        title: "Confirmation email sent",
        description: "Please check your inbox and follow the link to confirm your email.",
      })
    } catch (error) {
      console.error("Error resending confirmation:", error)
      toast({
        variant: "destructive",
        title: "Failed to resend confirmation",
        description: "There was a problem sending the confirmation email. Please try again.",
      })
    } finally {
      setResendingEmail(false)
    }
  }

  if (!isMounted) {
    return (
      <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container flex h-[calc(100vh-4rem)] items-center justify-center">
      <Card className="mx-auto w-full max-w-md card-glow">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your email and password to access your account</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-sm font-medium text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-sm font-medium text-destructive">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          {needsEmailConfirmation && (
            <div className="mt-4 rounded-md bg-amber-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">Email not confirmed</h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <p>Please check your inbox and confirm your email before logging in.</p>
                  </div>
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resendConfirmationEmail}
                      disabled={resendingEmail}
                    >
                      {resendingEmail ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Resend confirmation email"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm">
            <Link href="/forgot-password" className="text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>
          <div className="text-center text-sm">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
