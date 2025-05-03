"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-provider"
import { Logo } from "@/components/logo"
import { UserDropdown } from "@/components/user-dropdown"
import { NotificationsDropdown } from "@/components/notifications-dropdown"
import { SearchAnalyses } from "@/components/search-analyses"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useAuth()

  const isActive = (path: string) => {
    return pathname === path
  }

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.body.style.overflow = "auto"
    }
  }, [mobileMenuOpen])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center">
        <div className="mr-4 md:mr-6">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6 text-sm">
          <Link
            href="/"
            className={`transition-colors hover:text-foreground/80 ${
              isActive("/") ? "font-medium text-foreground" : "text-foreground/60"
            }`}
          >
            Home
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center text-foreground/60 hover:text-foreground/80 transition-colors">
                Features <ChevronDown className="ml-1 h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/credit-analysis">Credit Analysis</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/history">Analysis History</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/progress">Progress Tracking</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href="/pricing"
            className={`transition-colors hover:text-foreground/80 ${
              isActive("/pricing") ? "font-medium text-foreground" : "text-foreground/60"
            }`}
          >
            Pricing
          </Link>

          <Link
            href="/resources"
            className={`transition-colors hover:text-foreground/80 ${
              isActive("/resources") ? "font-medium text-foreground" : "text-foreground/60"
            }`}
          >
            Resources
          </Link>

          <Link
            href="/faq"
            className={`transition-colors hover:text-foreground/80 ${
              isActive("/faq") ? "font-medium text-foreground" : "text-foreground/60"
            }`}
          >
            FAQ
          </Link>

          <Link
            href="/contact"
            className={`transition-colors hover:text-foreground/80 ${
              isActive("/contact") ? "font-medium text-foreground" : "text-foreground/60"
            }`}
          >
            Contact
          </Link>
        </nav>

        <div className="flex-1 flex justify-end md:justify-center px-4">{user && <SearchAnalyses />}</div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationsDropdown />
              <UserDropdown />
            </>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm" className="bg-brand-blue hover:bg-brand-blue/90 text-white">
                <Link href="/register">Register</Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            className="ml-2 md:hidden rounded-sm p-1.5 text-foreground/80 hover:bg-accent hover:text-accent-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 z-50 h-[calc(100vh-4rem)] bg-background md:hidden">
          <nav className="flex flex-col p-6 space-y-4">
            <Link
              href="/"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/") ? "font-medium bg-accent/50" : ""
              }`}
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/dashboard") ? "font-medium bg-accent/50" : ""
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/history") ? "font-medium bg-accent/50" : ""
              }`}
            >
              History
            </Link>
            <Link
              href="/progress"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/progress") ? "font-medium bg-accent/50" : ""
              }`}
            >
              Progress
            </Link>
            <Link
              href="/pricing"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/pricing") ? "font-medium bg-accent/50" : ""
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/resources"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/resources") ? "font-medium bg-accent/50" : ""
              }`}
            >
              Resources
            </Link>
            <Link
              href="/faq"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/faq") ? "font-medium bg-accent/50" : ""
              }`}
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className={`px-4 py-2 text-lg hover:bg-accent rounded-md ${
                isActive("/contact") ? "font-medium bg-accent/50" : ""
              }`}
            >
              Contact
            </Link>

            {!user && (
              <div className="pt-4 flex flex-col space-y-2">
                <Button asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
                >
                  <Link href="/register">Register</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
