import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"

import { PathwayLink } from "@/components/analytics/pathway-link"
import type { AnalyticsEventName } from "@/lib/analytics/events"

type PathwayOption = {
  eyebrow: string
  title: string
  body: string
  href: string
  action: string
}

type PathwayPageProps = {
  eyebrow: string
  title: string
  body: string
  primary: PathwayOption
  options: PathwayOption[]
  event: AnalyticsEventName
  note: ReactNode
}

export function PathwayPage({ eyebrow, title, body, primary, options, event, note }: PathwayPageProps) {
  return (
    <div className="vb-page min-h-screen">
      <section className="border-b border-white/10">
        <div className="vb-container grid min-h-[62svh] gap-12 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:py-28">
          <div>
            <p className="vb-eyebrow">{eyebrow}</p>
            <h1 className="vb-display mt-5 max-w-[12ch] text-5xl font-semibold leading-[0.96] tracking-[-0.05em] text-[#f3efe6] sm:text-7xl lg:text-8xl">
              {title}
            </h1>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-lg leading-8 text-[#aaa9a2] sm:text-xl sm:leading-9">{body}</p>
            <PathwayLink href={primary.href} analyticsEvent={event} placement="pathway_hero" className="vb-button vb-button-primary mt-8">
              {primary.action}
              <ArrowRight className="h-4 w-4" />
            </PathwayLink>
          </div>
        </div>
      </section>

      <section className="vb-section border-b border-white/10">
        <div className="vb-container">
          <div className="mb-10 grid gap-5 lg:grid-cols-2 lg:items-end">
            <h2 className="vb-section-title">Choose the route that fits now.</h2>
            <div className="text-sm leading-6 text-[#8f9189] lg:justify-self-end">{note}</div>
          </div>
          <div className="border-t border-white/10">
            {[primary, ...options].map((option, index) => (
              <article key={`${option.href}-${option.title}`} className="grid gap-5 border-b border-white/10 py-8 sm:py-10 lg:grid-cols-[4rem_0.8fr_1fr_auto] lg:items-center lg:gap-8">
                <span className="font-mono text-xs tracking-[0.18em] text-[#6f716a]">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b7ff3c]">{option.eyebrow}</p>
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.025em] text-[#f3efe6]">{option.title}</h3>
                  <p className="mt-2 max-w-2xl leading-7 text-[#aaa9a2]">{option.body}</p>
                </div>
                <PathwayLink href={option.href} analyticsEvent={event} placement={`pathway_option_${index + 1}`} className="vb-text-link justify-self-start lg:justify-self-end">
                  {option.action}
                  <ArrowRight className="h-4 w-4" />
                </PathwayLink>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
