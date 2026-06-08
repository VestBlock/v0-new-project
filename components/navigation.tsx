'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Menu,
  Loader2,
  User,
  LogOut,
  CreditCard,
  FileText,
  Briefcase,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isClientAdmin } from '@/lib/auth/client-admin';
import React from 'react';
import { BrandLogo } from '@/components/brand-logo';

export function Navigation() {
  const { user, userProfile, isAuthenticated, signOut, isLoading } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const isAdmin = React.useMemo(
    () =>
      isClientAdmin({
        email: user?.email,
        role: userProfile?.role,
      }),
    [user?.email, userProfile?.role]
  );

  // Main public navigation links
  const mainNavLinks = [
    { href: '/sell', label: 'Sellers' },
    { href: '/buyers', label: 'Buyers' },
    { href: '/lenders', label: 'Lenders' },
    { href: '/dealvault', label: 'DealVault' },
    { href: '/real-estate-funding', label: 'Capital' },
    { href: '/pricing', label: 'Pricing' },
  ];

  const isActiveLink = (href: string) => {
    const baseHref = href.split('#')[0];
    if (baseHref === '/') return pathname === '/';
    return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
  };

  // User menu links (when logged in)
  const userMenuLinks = [
    { href: '/dashboard/services', label: 'Network Workspace', icon: Sparkles },
    { href: '/get-started', label: 'Network Hub', icon: LayoutDashboard },
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/dashboard/funding', label: 'Funding Assistant', icon: Sparkles },
    { href: '/dashboard', label: 'Dashboard', icon: FileText },
    { href: '/credit-upload', label: 'Credit Upload', icon: CreditCard },
    { href: '/tools/my-dispute-letters', label: 'Dispute Letters', icon: FileText },
    { href: '/tools/business-credit', label: 'Business Credit', icon: Briefcase },
    ...(process.env.NEXT_PUBLIC_ENABLE_DEALVAULT === 'true'
      ? [{ href: '/dashboard/dealvault', label: 'DealVault', icon: Briefcase }]
      : []),
  ];

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#050913]/85 shadow-[0_10px_40px_rgba(2,6,23,0.22)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#050913]/70">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="group mr-6 flex items-center rounded-full outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <BrandLogo showTagline />
          </Link>
          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-6 text-sm font-medium lg:flex">
            {mainNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-full px-3 py-2 transition-[color,background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-foreground hover:shadow-[0_0_24px_rgba(34,211,238,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  isActiveLink(link.href)
                    ? 'bg-white/[0.08] text-foreground shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]'
                    : 'text-foreground/60'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
          {/* Mobile Menu */}
          <div className="lg:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader className="sr-only">
                  <SheetTitle>Site navigation</SheetTitle>
                  <SheetDescription>
                    Browse VestBlock seller, buyer, lender, funding, and DealVault paths.
                  </SheetDescription>
                </SheetHeader>
                <Link href="/" className="group mb-6 flex items-center">
                  <BrandLogo showTagline />
                </Link>
                <div className="flex flex-col space-y-2">
                  {mainNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="rounded-xl px-3 py-2 text-foreground transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-white/[0.06]"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <hr className="my-2" />
                  {!isAuthenticated ? (
                    <>
                      <Link href="/login?redirect=/dashboard/services" onClick={() => setIsMobileMenuOpen(false)} className="text-foreground">
                        Sign In
                      </Link>
                      <Link
                        href="/get-started"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="rounded-xl px-3 py-2 font-medium text-foreground transition-colors hover:bg-white/[0.05]"
                      >
                        Join Network
                      </Link>
                    </>
                  ) : (
                    <>
                      {userMenuLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="rounded-xl px-3 py-2 text-foreground transition-colors hover:bg-white/[0.05]"
                        >
                          {link.label}
                        </Link>
                      ))}
                      {(userProfile?.role === 'admin' || isAdmin) && (
                        <Link href="/admin-panel" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-2 text-foreground transition-colors hover:bg-white/[0.05]">
                          Admin Panel
                        </Link>
                      )}
                      <button
                        onClick={async () => {
                          setIsMobileMenuOpen(false);
                          await signOut();
                        }}
                        className="text-left text-foreground"
                      >
                        Sign Out
                      </button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Auth Section */}
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {getInitials(userProfile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userProfile?.full_name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userMenuLinks.map((link) => (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link href={link.href}>
                      <link.icon className="mr-2 h-4 w-4" />
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                {(userProfile?.role === 'admin' || isAdmin) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin-panel">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <nav className="hidden items-center space-x-2 md:flex">
              <Button variant="ghost" asChild>
                <Link href="/login?redirect=/dashboard/services">Sign In</Link>
              </Button>
              <Button asChild className="bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.25)] transition-all duration-200">
                <Link href="/get-started">Join Network</Link>
              </Button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
