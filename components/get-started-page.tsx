'use client';

import Link from 'next/link';
import { ArrowRight, Building2, CircleDollarSign, Compass, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';

const paths = [
  {
    title: 'Capital',
    body: 'Organize a business or real-estate funding request, understand readiness, or share lender criteria.',
    icon: CircleDollarSign,
    href: '/capital',
    action: 'Find a capital path',
    links: [
      ['Business funding', '/funding'],
      ['Real-estate funding', '/real-estate-funding'],
      ['Lender network', '/lenders'],
    ],
  },
  {
    title: 'Deals',
    body: 'Explore or analyze a property, submit one for review, share a buy box, or document an active deal.',
    icon: Building2,
    href: '/deals',
    action: 'Choose a deal path',
    links: [
      ['Submit a property', '/sell'],
      ['Share a buy box', '/buyers'],
      ['See DealVault', '/dealvault/demo'],
    ],
  },
  {
    title: 'Opportunities',
    body: 'Review grants, business-credit guidance, practical learning, and selected business resources.',
    icon: Compass,
    href: '/opportunities',
    action: 'Explore opportunities',
    links: [
      ['Review grants', '/tools/grants'],
      ['Understand business credit', '/tools/business-credit'],
      ['Browse learning', '/learn'],
    ],
  },
] as const;

export function GetStartedPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <main className="vb-page min-h-screen">
      <section className="border-b border-white/10">
        <div className="vb-container grid gap-10 py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-end lg:py-28">
          <div>
            <p className="vb-eyebrow">Choose your direction</p>
            <h1 className="vb-display mt-5 max-w-[12ch] text-5xl font-semibold leading-[0.96] tracking-[-0.05em] text-[#f3efe6] sm:text-7xl">
              What do you need to move forward?
            </h1>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-lg leading-8 text-[#aaa9a2]">
              Start with capital, a deal, or a practical opportunity. Each path explains what to provide and what happens next.
            </p>
            <div className="mt-6 border-l border-[#b7ff3c]/50 pl-4 text-sm leading-6 text-[#c7c5bd]">
              {isAuthenticated ? (
                <p>Signed in as {user?.email || 'your VestBlock account'}. Saved activity can remain connected to this account.</p>
              ) : (
                <p>Public reviews can start without an account. VestBlock will clearly ask you to sign in before saving private work or opening an account-only area.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="paths" className="vb-section scroll-mt-24 border-b border-white/10">
        <div className="vb-container grid gap-px overflow-hidden border border-white/10 bg-white/10 lg:grid-cols-3">
          {paths.map((path) => {
            const Icon = path.icon;
            return (
              <article key={path.title} className="min-w-0 bg-[#0d100d] p-6 sm:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#b7ff3c]/10 text-[#b7ff3c]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-[#f3efe6]">{path.title}</h2>
                <p className="mt-3 min-h-0 text-sm leading-6 text-[#aaa9a2] lg:min-h-[6rem]">{path.body}</p>
                <Button asChild className="mt-6 min-h-11 w-full bg-[#b7ff3c] text-[#11130f] hover:bg-[#cbff75]">
                  <Link href={path.href}>
                    {path.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <div className="mt-6 border-t border-white/10 pt-4">
                  {path.links.map(([label, href]) => (
                    <Link key={href} href={href} className="vb-text-link flex justify-between">
                      {label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="vb-container grid gap-6 py-10 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <ShieldCheck className="h-6 w-6 text-[#b7ff3c]" />
          <div>
            <h2 className="text-lg font-semibold text-[#f3efe6]">Private records stay behind sign-in.</h2>
            <p className="mt-1 text-sm leading-6 text-[#aaa9a2]">Submitting an inquiry does not promise funding, a buyer, a grant, or a business result. Terms and eligibility must be verified before you act.</p>
          </div>
          <Link href="/how-it-works" className="vb-text-link">How VestBlock works <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </main>
  );
}
