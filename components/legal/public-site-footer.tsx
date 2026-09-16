'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PRIVATE_PREFIXES = [
  '/admin',
  '/dashboard',
  '/workspace',
  '/profile',
  '/roadmap',
  '/credit-upload',
  '/credit-dashboard',
  '/super-dispute',
  '/tools',
  '/auth-debug',
  '/database-diagnostic',
  '/setup-database',
  '/dev',
  '/sell',
];

export function PublicSiteFooter() {
  const pathname = usePathname();
  if (PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-[#090d0f] text-white/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 text-sm sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-medium text-white">Vestblock LLC</p>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Plan your next move across capital, deals, and opportunity. Independent providers make their own decisions; results are not guaranteed.
          </p>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-3">
          <Link className="inline-flex min-h-11 items-center transition-colors hover:text-white" href="/privacy">Privacy</Link>
          <Link className="inline-flex min-h-11 items-center transition-colors hover:text-white" href="/security">Security</Link>
          <Link className="inline-flex min-h-11 items-center transition-colors hover:text-white" href="/terms">Terms</Link>
          <Link className="inline-flex min-h-11 items-center transition-colors hover:text-white" href="/accessibility">Accessibility</Link>
        </nav>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} Vestblock LLC</p>
      </div>
    </footer>
  );
}
