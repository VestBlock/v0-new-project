"use client"

import { useState } from "react"
import { DecisionProofSection } from "./decision-proof-section"
import { HomepageDirectory, type HomepageOutcomeId, homepageOutcomes } from "./homepage-directory"

export function HomepageDecisionFlow() {
  const [selectedId, setSelectedId] = useState<HomepageOutcomeId>("deals")
  const selected = homepageOutcomes.find((outcome) => outcome.id === selectedId) || homepageOutcomes[0]

  return (
    <>
      <HomepageDirectory selectedId={selectedId} onSelect={setSelectedId} />
      <p className="sr-only" role="status" aria-live="polite">{selected.label} outcome selected.</p>
      <DecisionProofSection outcomeId={selectedId} />
    </>
  )
}
