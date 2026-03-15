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
  LayoutDashboard,
  // Badge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import React from 'react';
import { Badge } from './ui/badge';

export function Navigation() {
  const { user, userProfile, isAuthenticated, signOut, isLoading } = useAuth();
  console.debug('🚀 ~ Navigation ~ user:', userProfile);
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = React.useState(false);

  const allNavLinks = [
    // { href: '/dashboard', label: 'Dashboard', auth: true },
    { href: '/credit-upload', label: 'Credit Upload', auth: true },
    {
      href: '/tools/my-dispute-letters',
      label: 'Dispute Letters',
      auth: true,
      isPro: true,
    },
    { href: '/tools/grants', label: 'Grant Writer', auth: true, isPro: true },
    {
      href: '/tools/business-credit',
      label: 'Business Credit',
      auth: true,
      isPro: true,
    },
    ...(userProfile?.role === 'admin'
      ? [
          {
            href: '/admin-panel',
            label: 'Admin Panel',
            auth: true,
          },
        ]
      : []),
  ];

  const navLinks = allNavLinks.filter((link) => isAuthenticated && link.auth);

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

  const isProMember = userProfile?.is_subscribed || isAdmin;

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
          <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.isPro && !isProMember ? '' : link.href}
                className={cn(
                  'transition-colors hover:text-foreground/80',
                  pathname === link.href
                    ? 'text-foreground'
                    : 'text-foreground/60',
                  link.isPro && !isProMember && 'opacity-60'
                )}
              >
                {link.label}

                {link.isPro && !isProMember && (
                  <Badge className="ml-2 opacity-60">Pro</Badge>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-2">
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
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

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
                {/* <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem> */}
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
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
              <Button asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
