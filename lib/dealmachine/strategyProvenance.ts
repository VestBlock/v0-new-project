export type DealMachineStrategyProvenance = {
  key: string
  reviewOnly: boolean
  candidateOnly: boolean
  candidateReason: string | null
  variant: string
  signals: string[]
}

const rows: DealMachineStrategyProvenance[] = [
  { key: 'preforeclosure-equity', reviewOnly: true, candidateOnly: false, candidateReason: null, variant: 'active-mortgage', signals: ['preforeclosure', 'active_mortgage'] },
  { key: 'tax-code-stack', reviewOnly: true, candidateOnly: true, candidateReason: 'DealMachine verifies tax delinquency; county code-enforcement evidence is still required.', variant: 'tax-candidate', signals: ['tax_delinquent'] },
  { key: 'tax-remote-equity-rotation', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'remote-equity', signals: ['tax_delinquent', 'absentee_owner', 'equity'] },
  { key: 'lien-equity', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'active-lien', signals: ['lien', 'equity'] },
  { key: 'probate-vacant-equity', reviewOnly: true, candidateOnly: false, candidateReason: null, variant: 'probate-vacant', signals: ['probate', 'vacant', 'equity'] },
  { key: 'portfolio-landlord', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'multiple-investments', signals: ['portfolio_owner', 'absentee_owner'] },
  { key: 'small-multifamily-portfolio', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'two-to-twenty-units', signals: ['multifamily', 'portfolio_owner'] },
  { key: 'builder-infill-teardown', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'infill-land', signals: ['land', 'vacant'] },
  { key: 'land-wholesale', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'vacant-land', signals: ['land'] },
  { key: 'vacant-equity', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'vacant-equity', signals: ['vacant', 'equity'] },
  { key: 'seller-finance-free-clear', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'free-clear', signals: ['free_and_clear'] },
  { key: 'subject-to-low-equity', reviewOnly: true, candidateOnly: false, candidateReason: null, variant: 'mortgage-low-equity', signals: ['active_mortgage', 'low_equity'] },
  { key: 'hybrid-equity-bridge', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'mortgage-mid-equity', signals: ['active_mortgage', 'equity'] },
  { key: 'novation-retail-equity', reviewOnly: true, candidateOnly: false, candidateReason: null, variant: 'stale-retail-equity', signals: ['retail_equity', 'stale_listing', 'equity'] },
  { key: 'absentee-equity-creative', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'absentee-equity', signals: ['absentee_owner', 'equity'] },
  { key: 'active-stale-creative', reviewOnly: false, candidateOnly: false, candidateReason: null, variant: 'stale-terms', signals: ['stale_listing', 'price_fit'] },
  { key: 'active-stale-lowball', reviewOnly: true, candidateOnly: false, candidateReason: null, variant: 'distressed-cash-review', signals: ['stale_listing', 'distressed_condition'] },
]

export const DEALMACHINE_STRATEGY_PROVENANCE = new Map(rows.map((row) => [row.key, row]))

export function dealMachineStrategyProvenance(strategyKey: string | null | undefined) {
  return strategyKey ? DEALMACHINE_STRATEGY_PROVENANCE.get(strategyKey) || null : null
}
