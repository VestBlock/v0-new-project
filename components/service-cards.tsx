'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  Home,
  Landmark,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const primaryOffers = [
  {
    title: 'Seller Property Review',
    summary:
      'A direct path for property owners to share deal details, timing, condition, payoff context, and preferred sale route before follow-up.',
    points: [
      'Property and seller intake',
      'Fast cash, creative, or novation review paths',
      'Cleaner follow-up for serious seller opportunities',
    ],
    route: '/sell',
    cta: 'Submit Property',
    label: 'Seller path',
    icon: Home,
    accent:
      'border-cyan-500/25 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(255,255,255,0.02))]',
  },
  {
    title: 'Buyer Buy Box',
    summary:
      'A dedicated path for buyers to share markets, asset types, price range, proof, and close speed.',
    points: [
      'Markets and asset criteria',
      'Price range and proof status',
      'Cleaner matching before seller opportunities are sent',
    ],
    route: '/buyers',
    cta: 'Share Buy Box',
    label: 'Buyer path',
    icon: Users,
    accent:
      'border-blue-500/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(255,255,255,0.02))]',
  },
  {
    title: 'Lender Network',
    summary:
      'A clean signup path for lenders to share states, loan range, borrower fit, and no-go criteria.',
    points: [
      'Lending box intake',
      'States, loan size, and borrower fit',
      'Introductions only when criteria fit',
    ],
    route: '/lenders',
    cta: 'Join Lender Network',
    label: 'Lender path',
    icon: Landmark,
    accent:
      'border-amber-400/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(255,255,255,0.02))]',
  },
  {
    title: 'DealVault Records',
    summary:
      'Deal records, payout splits, proof certificates, and milestone tracking for real estate teams that need accountability.',
    points: [
      'Tamper-evident agreement records',
      'Payout ledger and partner split visibility',
      'Milestone history and certificate-ready audit trail',
    ],
    route: '/dealvault/demo',
    cta: 'Request Private Demo',
    label: 'Flagship',
    icon: ShieldCheck,
    accent:
      'border-violet-500/20 bg-[linear-gradient(180deg,rgba(139,92,246,0.12),rgba(255,255,255,0.02))]',
  },
] as const;

const supportOffers = [
  { label: 'Partner Intake Support', href: '/dealflow-growth-system' },
  { label: 'Developer / Contractor Network', href: '/real-estate-funding' },
  { label: 'AI Intake & Reception', href: '/ai-assistant' },
  { label: 'Funding Prep', href: '/funding' },
  { label: 'Business Setup', href: '/business-setup' },
  { label: 'Credit Support', href: '/services/ai-credit-analysis' },
  { label: 'Prep Reviews', href: '/services/financial-growth' },
] as const;

export function ServiceCards() {
  return (
    <section className="px-4 py-14 md:py-20">
      <div className="container mx-auto">
        <div className="mx-auto mb-8 max-w-3xl text-center md:mb-12">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Core products</p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl md:text-5xl">
            Real estate partnerships first. Support behind them.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base md:text-lg md:leading-8">
            VestBlock brings seller intake, buyer criteria, lender fit, operator partners, and DealVault records into one connected partner experience.
          </p>
        </div>

        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {primaryOffers.map((offer) => {
            const Icon = offer.icon;

            return (
              <motion.div
                key={offer.title}
                transition={{ duration: 0.25 }}
                whileHover={{ y: -8 }}
              >
                <Link
                  href={offer.route}
                  className={`group flex h-full flex-col rounded-[1.75rem] border ${offer.accent} p-6 backdrop-blur-xl transition-[border-color,box-shadow,transform,background-color] duration-300 hover:border-cyan-300/35 hover:shadow-[0_28px_70px_rgba(8,145,178,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/20 transition-colors duration-200 group-hover:bg-white/[0.08]">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200">
                        {offer.label}
                      </Badge>
                    </div>
                    <h3 className="text-2xl font-semibold text-white">{offer.title}</h3>
                    <p className="mt-2 text-base leading-7 text-slate-300">
                      {offer.summary}
                    </p>
                  </div>
                  <div className="mt-6 flex h-full flex-col">
                    <div className="space-y-3 text-sm text-slate-300">
                      {offer.points.map((point) => (
                        <div key={point} className="flex items-start gap-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                          <p className="leading-6">{point}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white">
                      {offer.cta}
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="premium-section mx-auto mt-8 max-w-5xl p-5 text-center md:mt-10 md:p-6">
          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-white">
            <BriefcaseBusiness className="h-4 w-4 text-cyan-400" />
            More support when you need it.
          </div>
          <p className="mx-auto max-w-3xl text-sm leading-6 text-slate-400 md:leading-7">
            Real estate funding review, developer and contractor routing, AI intake, setup, and credit services are available as support around seller, buyer, lender, operator, and DealVault paths.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {supportOffers.map((offer) => (
              <Button key={offer.label} asChild size="sm" variant="outline" className="border-white/10 bg-transparent hover:bg-white/[0.04]">
                <Link href={offer.href}>{offer.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
