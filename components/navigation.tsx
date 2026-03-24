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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Menu,
  Loader2,
  User,
  LogOut,
  CreditCard,
  FileText,
  Briefcase,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import React from 'react';

export function Navigation() {
  const { user, userProfile, isAuthenticated, signOut, isLoading } = useAuth();
  console.debug('🚀 ~ Navigation ~ user:', userProfile);
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = React.useState(false);

  // Main public navigation links
  const mainNavLinks = [
    { href: '/funding', label: 'Funding' },
    { href: '/ai-assistant', label: 'AI Assistant' },
    { href: '/credit-upload', label: 'Credit Tools' },
    { href: '/sell', label: 'Sell Property' },
  ];

  // User menu links (when logged in)
  const userMenuLinks = [
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/credit-upload', label: 'Credit Upload', icon: CreditCard },
    { href: '/tools/my-dispute-letters', label: 'Dispute Letters', icon: FileText },
    { href: '/tools/business-credit', label: 'Business Credit', icon: Briefcase },
  ];

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  React.useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (user && user.email === adminEmail) {
      setIsAdmin(true);
    }
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Image
              src="/4D3E27E0-6C7A-4B5B-92D5-CF92182A4C7A.png"
              alt="VestBlock Logo"
              width={28}
              height={28}
            />
            <span className="font-bold">VestBlock</span>
          </Link>
          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
            {mainNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'transition-colors hover:text-foreground/80',
                  pathname === link.href
                    ? 'text-foreground'
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
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <Link href="/" className="mb-6 flex items-center space-x-2">
                  <Image
                    src="/4D3E27E0-6C7A-4B5B-92D5-CF92182A4C7A.png"
                    alt="VestBlock Logo"
                    width={28}
                    height={28}
                  />
                  <span className="font-bold">VestBlock</span>
                </Link>
                <div className="flex flex-col space-y-3">
                  {mainNavLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <hr className="my-2" />
                  {!isAuthenticated ? (
                    <>
                      <Link href="/login" className="text-foreground">
                        Sign In
                      </Link>
                      <Link href="/register" className="text-foreground font-medium">
                        Get Started
                      </Link>
                    </>
                  ) : (
                    <>
                      {userMenuLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="text-foreground"
                        >
                          {link.label}
                        </Link>
                      ))}
                      {(userProfile?.role === 'admin' || isAdmin) && (
                        <Link href="/admin-panel" className="text-foreground">
                          Admin Panel
                        </Link>
                      )}
                      <button
                        onClick={signOut}
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
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
                <Link href="/register">Get Started</Link>
              </Button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
