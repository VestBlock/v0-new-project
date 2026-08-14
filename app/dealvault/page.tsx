import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, BadgeCheck, Blocks, FileCheck2, Link2, ReceiptText, ShieldCheck } from 'lucide-react'

import { DealVaultPilotInterestForm } from '@/components/dealvault/dealvault-pilot-interest-form'
import { dealVaultPublicContracts, dealVaultPublicDemo, shortenHex } from '@/lib/dealvault/contractMetadata'
import { absoluteUrl } from '@/lib/seo/site'
import { breadcrumbJsonLd, dealVaultFaqJsonLd, dealVaultServiceJsonLd } from '@/lib/seo/structuredData'

export const metadata: Metadata = {
  title: 'DealVault Proof, Payout, and Milestone Records',
  description: 'DealVault by VestBlock keeps agreements, payout terms, milestone history, and verifiable proof connected to the work they support.',
  alternates: { canonical: '/dealvault' },
  openGraph: {
    title: 'DealVault by VestBlock',
    description: 'A durable record for agreements, payout terms, milestones, and approvals.',
    url: absoluteUrl('/dealvault'),
    images: [{ url: absoluteUrl('/dealvault/opengraph-image'), width: 1200, height: 630, alt: 'DealVault by VestBlock preview' }],
  },
}

const recordLayers = [
  { number: '01', title: 'Agreement record', body: 'Retain the version, terms, timestamps, and permissions connected to a commitment without placing private documents on-chain.', icon: FileCheck2 },
  { number: '02', title: 'Payout reference', body: 'Keep referral, partner, and split terms in a durable ledger before memory or scattered messages become the record.', icon: ReceiptText },
  { number: '03', title: 'Milestone history', body: 'Connect submissions, approvals, disputes, and completion events to the work they belong to.', icon: Blocks },
]

const useCases = [
  'Real-estate agreement and partner-split records',
  'Private-lending and referral accountability',
  'Contractor and field-service milestone approvals',
  'Agency, consulting, and client-deliverable history',
  'Staffing, recruiting, and placement-fee records',
  'Custom agreements that need a durable proof timeline',
]

const pricingTiers = [
  { name: 'Solo Investor', price: '$97/mo', note: 'For an individual maintaining active agreement, payout, and milestone records.', items: ['Core proof records', 'Payout-ledger support', 'Milestone tracking', 'Pilot onboarding'] },
  { name: 'Team', price: '$297/mo', note: 'For teams coordinating multiple partners, vendors, or milestone owners.', items: ['Everything in Solo Investor', 'Multi-user access', 'Guided rollout', 'Team record controls'] },
  { name: 'Business', price: '$997/mo', note: 'For higher-volume organizations that need a structured implementation.', items: ['Everything in Team', 'Custom setup planning', 'Priority support', 'Deeper rollout support'] },
]

const faqs = [
  { question: 'What is recorded on-chain?', answer: 'Hashes, proof IDs, timestamps, statuses, and opaque record references. Sensitive documents, names, and raw property details remain off-chain.' },
  { question: 'Does DealVault replace escrow, title, or legal counsel?', answer: 'No. It supports record continuity and verification; it does not replace legal, title, escrow, brokerage, or other licensed services.' },
  { question: 'Do customers need a wallet?', answer: 'No wallet connection is required for the standard customer experience.' },
]

const sectionClass = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'

export default function DealVaultLandingPage() {
  const structuredData = [
    breadcrumbJsonLd([{ name: 'VestBlock', path: '/' }, { name: 'DealVault', path: '/dealvault' }]),
    dealVaultServiceJsonLd(),
    dealVaultFaqJsonLd(),
  ]

  return (
    <main className="vb-dealvault-page bg-[#06090c] text-[#f1f3ed]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="relative overflow-hidden border-b border-white/10 pt-28 sm:pt-36">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(215,248,11,0.08),transparent_34%),radial-gradient(circle_at_80%_34%,rgba(241,243,237,0.09),transparent_30%)]" />
        <div className={`${sectionClass} relative grid gap-14 pb-20 lg:grid-cols-[1.06fr_.94fr] lg:items-end lg:pb-28`}>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#d7f80b]">DealVault · VestBlock record layer</p>
            <h1 className="mt-6 max-w-4xl text-5xl font-medium leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-8xl">
              Keep the record that supports the work.
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              DealVault keeps agreements, payout terms, milestones, and approvals connected to the active work—while sensitive material stays private.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="#dealvault-demo" className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#d7f80b] px-6 text-sm font-semibold text-[#06090c] transition hover:bg-[#ecff5d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d7f80b]">
                Request a private demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dealvault/demo-record" className="inline-flex min-h-12 items-center justify-center border border-white/20 px-6 text-sm font-medium text-white transition hover:border-[#d7f80b]/70 hover:text-[#d7f80b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d7f80b]">
                Inspect a sample record
              </Link>
            </div>
          </div>

          <div className="border-l border-[#d7f80b]/45 pl-6 sm:pl-8">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-400">Record continuity</p>
            <div className="mt-7 grid grid-cols-2 gap-x-8 gap-y-7">
              <div><p className="text-2xl font-medium">Polygon</p><p className="mt-1 text-sm text-slate-400">Live proof network</p></div>
              <div><p className="text-2xl font-medium">Private</p><p className="mt-1 text-sm text-slate-400">Documents remain off-chain</p></div>
              <div><p className="text-2xl font-medium">Verifiable</p><p className="mt-1 text-sm text-slate-400">Explorer-linked records</p></div>
              <div><p className="text-2xl font-medium">Accessible</p><p className="mt-1 text-sm text-slate-400">No wallet required</p></div>
            </div>
            <p className="mt-9 border-t border-white/10 pt-5 text-sm leading-6 text-slate-400">
              DealVault supports recordkeeping. It does not replace signed agreements, escrow, title, legal counsel, or required licensed professionals.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-20 lg:py-28">
        <div className={sectionClass}>
          <div className="grid gap-10 lg:grid-cols-[.65fr_1.35fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#d7f80b]">One connected record</p>
              <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">From commitment to completion.</h2>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {recordLayers.map(({ number, title, body, icon: Icon }) => (
                <article key={title} className="grid gap-4 py-7 sm:grid-cols-[3rem_2rem_1fr] sm:items-start">
                  <span className="font-mono text-xs text-slate-500">{number}</span>
                  <Icon className="h-5 w-5 text-[#d7f80b]" aria-hidden="true" />
                  <div><h3 className="text-xl font-medium">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{body}</p></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="live-contracts" className="border-b border-white/10 bg-[#0a0e11] py-20 lg:py-28">
        <div className={sectionClass}>
          <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#d7f80b]">Live verification layer</p>
              <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Proof close to the decision.</h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-400">
                Review the production contract references and verified record IDs directly. The public proof is visible; private source material is not.
              </p>
              <div className="mt-9 border-l border-white/15 pl-5 text-sm leading-7 text-slate-300">
                <p>Network: {dealVaultPublicDemo.network}</p>
                <p>Chain ID: {dealVaultPublicDemo.chainId}</p>
                <p>Live since: {new Date(dealVaultPublicDemo.liveSince).toLocaleDateString('en-US')}</p>
              </div>
            </div>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {dealVaultPublicContracts.map((contract) => (
                <article key={contract.key} className="py-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">{contract.label}</p><h3 className="mt-2 text-xl font-medium">{contract.title}</h3></div>
                    <a className="inline-flex min-h-11 items-center gap-2 text-sm text-[#d7f80b] underline decoration-[#d7f80b]/35 underline-offset-4 hover:decoration-[#d7f80b]" href={contract.explorerUrl} target="_blank" rel="noopener noreferrer">PolygonScan <Link2 className="h-4 w-4" /></a>
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{contract.description}</p>
                  <p className="mt-4 break-all font-mono text-xs text-slate-500">{shortenHex(contract.address, 12, 8)}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-20 lg:py-28">
        <div className={sectionClass}>
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#d7f80b]">Where it fits</p>
              <h2 className="mt-5 max-w-xl text-4xl font-medium tracking-[-0.04em] sm:text-5xl">For work that crosses people, terms, and time.</h2>
            </div>
            <ol className="grid gap-px bg-white/10 sm:grid-cols-2">
              {useCases.map((item, index) => <li key={item} className="min-h-32 bg-[#06090c] p-6"><span className="font-mono text-xs text-[#d7f80b]">0{index + 1}</span><p className="mt-5 text-sm leading-6 text-slate-300">{item}</p></li>)}
            </ol>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-b border-white/10 bg-[#f1f3ed] py-20 text-[#10161a] lg:py-28">
        <div className={sectionClass}>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#566100]">Plans</p>
          <div className="mt-5 flex flex-col gap-5 border-b border-black/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-3xl text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Choose the record discipline your team needs.</h2>
            <p className="max-w-md text-sm leading-6 text-black/60">Every plan keeps private source documents off-chain and includes a guided starting point.</p>
          </div>
          <div className="grid lg:grid-cols-3">
            {pricingTiers.map((tier, index) => (
              <article key={tier.name} className={`border-b border-black/15 py-8 lg:border-b-0 lg:px-8 ${index > 0 ? 'lg:border-l' : 'lg:pl-0'}`}>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-black/45">{tier.name}</p>
                <p className="mt-5 text-4xl font-medium tracking-[-0.04em]">{tier.price}</p>
                <p className="mt-5 min-h-16 text-sm leading-6 text-black/60">{tier.note}</p>
                <ul className="mt-7 space-y-3 border-t border-black/10 pt-6">{tier.items.map((item) => <li key={item} className="flex gap-3 text-sm"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#647000]" />{item}</li>)}</ul>
                <Link href="#dealvault-demo" className="mt-8 inline-flex min-h-11 items-center gap-2 border-b border-black pb-1 text-sm font-semibold">Request a demo <ArrowRight className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
          <p className="mt-8 text-xs leading-5 text-black/55">Custom setup may range from $997–$5,000 depending on scope. Any future transaction-linked pricing would require a separate agreement; it is not part of the current pilot plans.</p>
        </div>
      </section>

      <section className="border-b border-white/10 py-20 lg:py-28">
        <div className={`${sectionClass} grid gap-12 lg:grid-cols-[.9fr_1.1fr]`}>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#d7f80b]">Example output</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">A record you can inspect.</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">See how a proof certificate presents the record ID, network reference, and verification details without publishing private deal documents.</p>
            <a href={dealVaultPublicDemo.certificatePdfPath} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex min-h-12 items-center gap-2 bg-[#d7f80b] px-6 text-sm font-semibold text-[#06090c] hover:bg-[#ecff5d]">View sample certificate <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="border border-white/10 bg-white p-3"><Image src={dealVaultPublicDemo.certificateImagePath} alt="DealVault sample proof certificate" width={1200} height={900} className="h-auto w-full" /></div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#0a0e11] py-20 lg:py-28">
        <div className={`${sectionClass} grid gap-12 lg:grid-cols-[.7fr_1.3fr]`}>
          <div><p className="font-mono text-xs uppercase tracking-[0.24em] text-[#d7f80b]">Clear boundaries</p><h2 className="mt-5 text-4xl font-medium tracking-[-0.04em]">Before you rely on the record.</h2></div>
          <div className="divide-y divide-white/10 border-y border-white/10">{faqs.map((item) => <article key={item.question} className="py-6"><h3 className="text-lg font-medium">{item.question}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{item.answer}</p></article>)}</div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className={`${sectionClass} grid gap-12 lg:grid-cols-[.72fr_1.28fr]`}>
          <div>
            <ShieldCheck className="h-7 w-7 text-[#d7f80b]" />
            <p className="mt-7 font-mono text-xs uppercase tracking-[0.24em] text-[#d7f80b]">Private demonstration</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">Bring the workflow you need to make durable.</h2>
            <p className="mt-6 max-w-lg text-sm leading-6 text-slate-400">Tell us where records fragment today. We’ll use that context to determine whether DealVault fits and what the next step should be.</p>
          </div>
          <DealVaultPilotInterestForm />
        </div>
      </section>
    </main>
  )
}
