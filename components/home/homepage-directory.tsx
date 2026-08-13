"use client"

import Link from "next/link"
import { ArrowRight, BriefcaseBusiness, Building2, CircleDollarSign, Landmark, ShieldCheck, TrendingUp } from "lucide-react"
import { useMemo, useState } from "react"
import { platformLanes, platformScenarios, type ScenarioId } from "@/lib/platform/lanes"

const scenarioIcons = {
  business: BriefcaseBusiness,
  property: Building2,
  sell: Landmark,
  readiness: TrendingUp,
  participate: CircleDollarSign,
}

export function HomepageDirectory() {
  const [selectedId, setSelectedId] = useState<ScenarioId>("business")
  const selected = useMemo(() => platformScenarios.find((scenario) => scenario.id === selectedId) || platformScenarios[0], [selectedId])
  const lane = platformLanes[selected.lane]

  const rememberChoice = () => {
    try {
      window.localStorage.setItem("vestblock:selected-scenario", selected.id)
      window.localStorage.setItem("vestblock:active-lane", selected.lane)
    } catch {
      // Exploration continues when storage is unavailable.
    }
  }

  return (
    <>
      <section id="choose-your-path" className="vb-scenario" aria-labelledby="scenario-title">
        <div className="vb-section-shell">
          <div className="vb-section-intro vb-section-intro--split">
            <div><p className="vb-kicker">Start with the outcome</p><h2 id="scenario-title">What are you trying to do next?</h2></div>
            <p>Choose the closest situation. VestBlock will show the right lane, what we organize, what another party decides, and what you need to continue.</p>
          </div>

          <div className="vb-scenario__workspace">
            <div className="vb-scenario__choices" aria-label="Choose your situation">
              {platformScenarios.map((scenario, index) => {
                const Icon = scenarioIcons[scenario.id]
                const active = scenario.id === selected.id
                return (
                  <button key={scenario.id} type="button" aria-pressed={active} data-active={active || undefined} onClick={() => setSelectedId(scenario.id)}>
                    <span>0{index + 1}</span><Icon aria-hidden="true" /><span><small>{scenario.short}</small><strong>{scenario.title}</strong></span><ArrowRight aria-hidden="true" />
                  </button>
                )
              })}
            </div>

            <article className="vb-scenario__preview" key={selected.id} aria-live="polite">
              <div className="vb-scenario__preview-head"><span>Recommended lane</span><strong>{lane.label}</strong></div>
              <h3>{selected.title}</h3>
              <dl>
                <div><dt>VestBlock organizes</dt><dd>{selected.vestblock}</dd></div>
                <div><dt>Who decides</dt><dd>{selected.decision}</dd></div>
                <div><dt>What to prepare</dt><dd>{selected.needed}</dd></div>
              </dl>
              <p><ShieldCheck aria-hidden="true" />{selected.access}</p>
              <div>
                <Link href={selected.href} onClick={rememberChoice} className="vb-button vb-button--primary">{selected.action}<ArrowRight aria-hidden="true" /></Link>
                <Link href="/next-move" onClick={rememberChoice} className="vb-button vb-button--quiet">Build a free roadmap</Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="vb-how" aria-labelledby="how-title">
        <div className="vb-section-shell">
          <div className="vb-section-intro vb-section-intro--split"><div><p className="vb-kicker">How VestBlock helps</p><h2 id="how-title">From a goal to coordinated next actions.</h2></div><p>VestBlock is the operating layer between an objective and the workflows, people, information, and records needed to move it forward responsibly.</p></div>
          <ol className="vb-how__steps">
            {[
              ["01", "Capture the context", "Start with the goal, role, timing, criteria, and current position."],
              ["02", "Organize readiness", "See the facts, preparation gaps, and decision boundaries in plain language."],
              ["03", "Route the next action", "Continue into the appropriate tool, intake, human review, or participant path."],
              ["04", "Keep work connected", "Save progress in your workspace and use DealVault when active work needs continuity."],
            ].map(([number, title, body]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="vb-lane-index" aria-labelledby="lane-index-title">
        <div className="vb-section-shell">
          <div className="vb-section-intro vb-section-intro--split"><div><p className="vb-kicker">The platform</p><h2 id="lane-index-title">Four lanes. One connected account.</h2></div><p>Each hub explains its complete path without forcing every detail onto the homepage.</p></div>
          <div className="vb-lane-index__grid">
            {(Object.values(platformLanes)).map((item, index) => (
              <Link key={item.id} href={item.href} className="vb-lane-index__item">
                <span>0{index + 1}</span><div><p>{item.eyebrow}</p><h3>{item.label}</h3><small>{item.introduction}</small></div><ArrowRight aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
