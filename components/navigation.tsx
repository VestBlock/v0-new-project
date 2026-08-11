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
  Menu,
  Loader2,
  User,
  LogOut,
  CreditCard,
  FileText,
  Briefcase,
  LayoutDashboard,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isClientAdmin } from '@/lib/auth/client-admin';
import React from 'react';
import { BrandLogo } from '@/components/brand-logo';

export function Navigation() {
  const { user, userProfile, isAuthenticated, signOut, isLoading } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const mobileTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const mobileCloseRef = React.useRef<HTMLButtonElement | null>(null);
  const mobilePanelRef = React.useRef<HTMLDivElement | null>(null);
  const isAdmin = React.useMemo(
    () =>
      isClientAdmin({
        email: user?.email,
        role: userProfile?.role,
      }),
    [user?.email, userProfile?.role]
  );

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const mobileTrigger = mobileTriggerRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = mobilePanelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    window.requestAnimationFrame(() => mobileCloseRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      mobileTrigger?.focus();
    };
  }, [isMobileMenuOpen]);

  // Admin surfaces run their own command shell; the marketing header stays out of the cockpit.
  if (pathname.startsWith('/admin') || pathname.startsWith('/dev/command-center-preview')) {
    return null;
  }

  // The public header routes by outcome. Role-specific and specialty tools live behind these doors.
  const mainNavLinks = [
    { href: '/capital', label: 'Capital' },
    { href: '/deals', label: 'Deals' },
    { href: '/opportunities', label: 'Opportunities' },
    { href: '/dealvault', label: 'DealVault' },
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
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#090a08]/94 backdrop-blur-md supports-[backdrop-filter]:bg-[#090a08]/82">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center px-5 sm:px-8 lg:px-12">
        <div className="mr-4 flex items-center">
          <Link href="/" className="group mr-8 flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#b7ff3c] focus-visible:ring-offset-4 focus-visible:ring-offset-[#090a08]">
            <BrandLogo showTagline />
          </Link>
          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
            {mainNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-2 transition-colors duration-200 hover:bg-white/[0.05] hover:text-[#f3efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b7ff3c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090a08]',
                  isActiveLink(link.href)
                    ? 'bg-white/[0.06] text-[#f3efe6]'
                    : 'text-[#9c9d96]'
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
            <Button ref={mobileTriggerRef} variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
            {isMobileMenuOpen ? (
              <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Site navigation">
                <button
                  type="button"
                  aria-label="Dismiss navigation backdrop"
                  className="absolute inset-0 cursor-default bg-background/70 backdrop-blur-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div ref={mobilePanelRef} className="relative h-full w-80 max-w-[88vw] overflow-y-auto border-r border-white/10 bg-[#090a08] p-6 shadow-2xl">
                  <button
                    ref={mobileCloseRef}
                    type="button"
                    aria-label="Close navigation"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-[#11130f] text-[#aaa9a2] hover:text-[#f3efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b7ff3c]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                <Link href="/" className="group mb-6 flex items-center">
                  <BrandLogo showTagline />
                </Link>
                <div className="flex flex-col space-y-2">
                  {mainNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex min-h-11 items-center rounded-md px-3 py-2 text-[#f3efe6] transition-colors hover:bg-white/[0.06]"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <hr className="my-2" />
                  {!isAuthenticated ? (
                    <>
                      <Link href="/login?redirect=/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex min-h-11 items-center rounded-md px-3 text-[#f3efe6]">
                        Sign In
                      </Link>
                      <Link
                        href="/get-started"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex min-h-12 items-center justify-center rounded-md bg-[#b7ff3c] px-3 py-2 font-semibold text-[#11130f] transition-colors hover:bg-[#cbff75]"
                      >
                        Start
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
                        <Link href="/admin/command-center" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-2 text-foreground transition-colors hover:bg-white/[0.05]">
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
                </div>
              </div>
            ) : null}
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
                      <Link href="/admin/command-center">
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
              <Button variant="ghost" asChild className="text-[#c7c5bd] hover:bg-white/[0.05] hover:text-[#f3efe6]">
                <Link href="/login?redirect=/dashboard">Log in</Link>
              </Button>
              <Button asChild className="rounded-md bg-[#b7ff3c] font-semibold text-[#11130f] shadow-none hover:bg-[#cbff75]">
                <Link href="/get-started">Start with VestBlock</Link>
              </Button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
