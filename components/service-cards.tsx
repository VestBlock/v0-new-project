'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const primaryLanes = [
  {
    title: 'DealVault',
    summary:
      'A premium proof, payout, and milestone layer for deal-driven businesses that need cleaner records and stronger accountability.',
    points: [
      'Agreement tracking and proof records',
      'Payout logic and partner visibility',
      'Milestone trails and certificate-ready activity',
    ],
    route: '/dealvault/demo',
    cta: 'See DealVault Demo',
    label: 'Flagship',
    icon: ShieldCheck,
    accent:
      'border-cyan-500/25 bg-[linear-gradient(180deg,rgba(34,211,238,0.14),rgba(255,255,255,0.02))]',
  },
  {
    title: 'Visibility Expansion',
    summary:
      'A recurring search and credibility service for businesses that want to be easier to find and easier to trust.',
    points: [
      'City and service pages',
      'Search, AI-answer, and PR support',
      'Clear monthly work instead of vague marketing',
    ],
    route: '/visibility-expansion',
    cta: 'Open Visibility Expansion',
    label: 'Growth',
    icon: Search,
    accent:
      'border-blue-500/20 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(255,255,255,0.02))]',
  },
  {
    title: 'AI Receptionist',
    summary:
      'A cleaner lead-capture and booking layer for teams that need faster response, better qualification, and less front-desk leakage.',
    points: [
      'After-hours response coverage',
      'Booking and intake improvement',
      'Higher-quality lead handoff',
    ],
    route: '/ai-assistant',
    cta: 'Open AI Receptionist',
    label: 'Growth',
    icon: Bot,
    accent:
      'border-violet-500/20 bg-[linear-gradient(180deg,rgba(139,92,246,0.12),rgba(255,255,255,0.02))]',
  },
] as const;

const supportLanes = [
  { label: 'Funding Prep', href: '/funding' },
  { label: 'Business Setup', href: '/business-setup' },
  { label: 'Credit Support', href: '/services/ai-credit-analysis' },
  { label: 'Real Estate Funding', href: '/real-estate-funding' },
  { label: 'Seller Path', href: '/sell' },
  { label: 'Financial Packages', href: '/services/financial-growth' },
] as const;

export function ServiceCards() {
  return (
    <section className="px-4 py-20">
      <div className="container mx-auto">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Core products</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">
            Three clear offers. One stronger brand.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            DealVault is the flagship demo path. Visibility helps customers find you. AI Receptionist helps you respond faster.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {primaryLanes.map((lane, index) => {
            const Icon = lane.icon;

            return (
              <motion.div
                key={lane.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
              >
                <Link
                  href={lane.route}
                  className={`group flex h-full flex-col rounded-[1.75rem] border ${lane.accent} p-6 backdrop-blur-xl transition-[border-color,box-shadow,transform,background-color] duration-300 hover:border-cyan-300/35 hover:shadow-[0_28px_70px_rgba(8,145,178,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/20 transition-colors duration-200 group-hover:bg-white/[0.08]">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200">
                        {lane.label}
                      </Badge>
                    </div>
                    <h3 className="text-2xl font-semibold text-white">{lane.title}</h3>
                    <p className="mt-2 text-base leading-7 text-slate-300">
                      {lane.summary}
                    </p>
                  </div>
                  <div className="mt-6 flex h-full flex-col">
                    <div className="space-y-3 text-sm text-slate-300">
                      {lane.points.map((point) => (
                        <div key={point} className="flex items-start gap-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
                          <p className="leading-6">{point}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white">
                      {lane.cta}
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="premium-section mx-auto mt-10 max-w-5xl p-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-white">
            <BriefcaseBusiness className="h-4 w-4 text-cyan-400" />
            More support when you need it.
          </div>
          <p className="mx-auto max-w-3xl text-sm leading-7 text-slate-400">
            Funding, setup, credit, and seller-specific services are still available. They work best after the main need is already clear.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {supportLanes.map((lane) => (
              <Button key={lane.label} asChild size="sm" variant="outline" className="border-white/10 bg-transparent hover:bg-white/[0.04]">
                <Link href={lane.href}>{lane.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
