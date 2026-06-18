export type AnalyzerReportType = 'investor' | 'buyer' | 'lender' | 'builder' | 'assignment_contract'

export type AnalyzerReportPayload = {
  reportType: AnalyzerReportType
  address: string
  form: Record<string, unknown>
  estimate: any
  opportunity: any
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Needs review'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function percent(value: number | null | undefined, suffix = '%') {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Needs review'
  return `${value}${suffix}`
}

function section(title: string, body: string) {
  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      ${body}
    </section>
  `
}

function metricGrid(items: Array<{ label: string; value: string }>) {
  return `
    <div class="metrics">
      ${items
        .map(
          (item) => `
            <div class="metric">
              <div class="metric-label">${escapeHtml(item.label)}</div>
              <div class="metric-value">${escapeHtml(item.value)}</div>
            </div>
          `
        )
        .join('')}
    </div>
  `
}

function badgeList(items: string[], tone: 'neutral' | 'warning' | 'danger' = 'neutral') {
  if (!items.length) {
    return `<p class="muted">None surfaced from the current inputs.</p>`
  }

  return `
    <div class="badge-list">
      ${items
        .map((item) => `<span class="badge badge-${tone}">${escapeHtml(item)}</span>`)
        .join('')}
    </div>
  `
}

function orderedList(items: string[]) {
  return `
    <ol class="list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ol>
  `
}

function reportHeading(reportType: AnalyzerReportType) {
  if (reportType === 'buyer') {
    return {
      title: 'VestBlock Buyer Packet',
      subtitle: 'Property summary and route notes for buyers reviewing the opportunity.',
    }
  }

  if (reportType === 'lender') {
    return {
      title: 'VestBlock Lender Packet',
      subtitle: 'Funding-readiness, capital-stack, and lender-fit snapshot for review.',
    }
  }

  if (reportType === 'builder') {
    return {
      title: 'VestBlock Builder Packet',
      subtitle: 'MAO-backed builder lane summary, rehab framing, and assignment strategy notes.',
    }
  }

  if (reportType === 'assignment_contract') {
    return {
      title: 'VestBlock Assignment Agreement Draft',
      subtitle: 'Draft internal assignment packet for builder or construction-partner review.',
    }
  }

  return {
    title: 'VestBlock Investor Deal Report',
    subtitle: 'Deal math, route fit, and risk framing based on the current analyzer inputs.',
  }
}

function buildTopMetrics(payload: AnalyzerReportPayload) {
  const { estimate, opportunity, reportType } = payload

  if (reportType === 'builder') {
    return [
      { label: 'Builder lane score', value: `${opportunity.builderDisposition?.score ?? 'Needs review'}/100` },
      { label: 'Builder max purchase', value: money(opportunity.builderDisposition?.builderMaxPurchase) },
      { label: 'Seller offer target', value: money(opportunity.builderDisposition?.recommendedSellerOffer) },
      { label: 'Assignment fee', value: money(opportunity.builderDisposition?.suggestedAssignmentFee) },
      { label: 'Rehab planning', value: `${money(opportunity.builderDisposition?.rehabPlanningLow)} - ${money(opportunity.builderDisposition?.rehabPlanningHigh)}` },
      { label: 'Strategy', value: String(opportunity.builderDisposition?.strategy || 'Needs review').replaceAll('_', ' ') },
    ]
  }

  if (reportType === 'assignment_contract') {
    return [
      { label: 'Property', value: payload.address },
      { label: 'Recommended seller offer', value: money(opportunity.builderDisposition?.recommendedSellerOffer) },
      { label: 'Builder max purchase', value: money(opportunity.builderDisposition?.builderMaxPurchase) },
      { label: 'Assignment fee', value: money(opportunity.builderDisposition?.suggestedAssignmentFee) },
      { label: 'Earnest money', value: money(opportunity.builderDisposition?.contractTerms?.earnestMoney) },
      { label: 'Close window', value: `${opportunity.builderDisposition?.contractTerms?.closeWindowDays ?? 'Needs review'} days` },
    ]
  }

  if (reportType === 'buyer') {
    return [
      { label: 'Asking price', value: money(estimate.askingPrice) },
      { label: 'Rough value', value: money(estimate.estimateValue) },
      { label: 'ARV', value: money(opportunity.metrics.arv) },
      { label: 'Repair budget', value: money(opportunity.metrics.repairBudget) },
      { label: 'Cash review', value: `${money(opportunity.metrics.conservativeCashReview)} - ${money(opportunity.metrics.balancedCashReview)}` },
      { label: 'Buyer fit', value: `${opportunity.buyerInterest.label} (${opportunity.buyerInterest.score}/100)` },
    ]
  }

  if (reportType === 'lender') {
    return [
      { label: 'Funding path', value: `${opportunity.fundingReadiness.recommendedPath}` },
      { label: 'Funding readiness', value: `${opportunity.fundingReadiness.score}/100` },
      { label: 'NOI', value: money(opportunity.metrics.netOperatingIncomeAnnual) },
      { label: 'DSCR', value: percent(opportunity.metrics.dscr, 'x') },
      { label: 'Debt yield', value: percent(opportunity.metrics.debtYieldPercent) },
      { label: 'Funding gap', value: money(opportunity.capitalStack.fundingGap) },
    ]
  }

  return [
    { label: 'Deal strength', value: `${opportunity.dealStrength.label} (${opportunity.dealStrength.score}/100)` },
    { label: 'Funding readiness', value: `${opportunity.fundingReadiness.label} (${opportunity.fundingReadiness.score}/100)` },
    { label: 'Rough value', value: money(estimate.estimateValue) },
    { label: 'Rent hint', value: money(estimate.rentEstimate) },
    { label: 'Cap rate', value: percent(opportunity.metrics.capRatePercent) },
    { label: 'Cash on cash (13% min)', value: percent(opportunity.metrics.cashOnCashReturnPercent) },
  ]
}

function buildSummaryCopy(payload: AnalyzerReportPayload) {
  const { opportunity, reportType } = payload

  if (reportType === 'builder') {
    return `
      <p class="lead">${escapeHtml(opportunity.builderDisposition?.summary || 'Builder fit still needs review.')}</p>
      <p class="muted">${escapeHtml(opportunity.builderDisposition?.sellerOutreachAngle || 'Confirm title, access, rehab scope, and buy-box rules before routing this opportunity.')}</p>
    `
  }

  if (reportType === 'assignment_contract') {
    return `
      <p class="lead">This is a planning-grade assignment draft built from the current analyzer numbers and builder-lane assumptions.</p>
      <p class="muted">Use it once the builder or construction partner confirms entity name, earnest money, close window, inspection terms, and assignment fee. Local legal review is still required before signature.</p>
    `
  }

  if (reportType === 'buyer') {
    return `
      <p class="lead">${escapeHtml(opportunity.buyerInterest.summary)}</p>
      <p class="muted">VestBlock still expects price, condition, title, occupancy, and seller motivation to be confirmed before this becomes a live buyer routing packet.</p>
    `
  }

  if (reportType === 'lender') {
    return `
      <p class="lead">${escapeHtml(opportunity.fundingReadiness.summary)}</p>
      <p class="muted">This packet is a screening artifact, not an underwriting commitment. All borrower, rent, insurance, tax, title, and collateral details still require independent review.</p>
    `
  }

  return `
    <p class="lead">${escapeHtml(opportunity.dealStrength.summary)}</p>
    <p class="muted">${escapeHtml(opportunity.fundingReadiness.summary)}</p>
  `
}

function buildPropertyFacts(payload: AnalyzerReportPayload) {
  const { form, estimate, opportunity } = payload
  const formValues = form as Record<string, unknown>

  return metricGrid([
    { label: 'Address', value: payload.address },
    { label: 'Property type', value: String(formValues.propertyType || 'Needs review') },
    { label: 'Condition', value: String(formValues.propertyCondition || 'Needs review') },
    { label: 'Occupancy', value: String(formValues.occupancyStatus || 'Needs review') },
    { label: 'Timeline', value: String(formValues.timelineToSell || 'Needs review') },
    { label: 'Exit strategy', value: String(formValues.exitStrategy || 'Needs review') },
    { label: 'Estimated value', value: money(estimate.estimateValue) },
    { label: 'Rent estimate', value: money(estimate.rentEstimate) },
    { label: 'ARV', value: money(opportunity.metrics.arv) },
    { label: 'Repair budget', value: money(opportunity.metrics.repairBudget) },
    { label: 'Mortgage balance', value: money(estimate.mortgageBalance) },
    { label: 'Liens / taxes', value: money(estimate.liensOrTaxesAmount) },
  ])
}

function buildFinancialOverview(payload: AnalyzerReportPayload) {
  const { opportunity } = payload
  return metricGrid([
    { label: 'Monthly operating expenses', value: money(opportunity.metrics.monthlyOperatingExpenses) },
    { label: 'Monthly cash flow', value: money(opportunity.metrics.estimatedMonthlyCashFlow) },
    { label: 'NOI', value: money(opportunity.metrics.netOperatingIncomeAnnual) },
    { label: 'Cap rate', value: percent(opportunity.metrics.capRatePercent) },
    { label: 'DSCR', value: percent(opportunity.metrics.dscr, 'x') },
    { label: 'Debt yield', value: percent(opportunity.metrics.debtYieldPercent) },
    { label: 'Break-even rent', value: money(opportunity.metrics.breakEvenRent) },
    { label: 'Rent / price ratio', value: percent(opportunity.metrics.rentToPriceRatioPercent) },
    { label: 'MAO 70%', value: money(opportunity.metrics.mao70) },
    { label: 'Flip profit', value: money(opportunity.metrics.flipProfit) },
    { label: 'Flip ROI', value: percent(opportunity.metrics.flipRoiPercent) },
    { label: 'Cash on cash (13% min)', value: percent(opportunity.metrics.cashOnCashReturnPercent) },
  ])
}

function buildComparableContext(payload: AnalyzerReportPayload) {
  const comps = payload.opportunity.comparables || {}
  const selected = Array.isArray(comps.selected) ? comps.selected.filter((comp: any) => comp?.salePrice) : []

  return `
    ${metricGrid([
      { label: 'ARV mode', value: payload.opportunity.dealMath?.arvMode || 'Needs review' },
      { label: 'Comp count used', value: String(comps.usedCount ?? selected.length ?? 0) },
      { label: 'Average comp sale', value: money(comps.averageSalePrice) },
      { label: 'Average price / sqft', value: comps.averagePricePerFoot ? `$${comps.averagePricePerFoot}` : 'Needs review' },
    ])}
    <div class="notes">
      <h3>Selected comps</h3>
      ${
        selected.length
          ? orderedList(
              selected.map((comp: any) => {
                const facts = [
                  comp.address || 'Comp address not added',
                  money(comp.salePrice),
                  comp.squareFeet ? `${comp.squareFeet} sqft` : null,
                  comp.distanceMiles ? `${comp.distanceMiles} mi` : null,
                  comp.pricePerFoot ? `$${comp.pricePerFoot}/sqft` : null,
                ].filter(Boolean)
                return facts.join(' • ')
              })
            )
          : '<p class="muted">No sold comps were entered for this analysis.</p>'
      }
    </div>
  `
}

function buildListingContext(payload: AnalyzerReportPayload) {
  const listing = payload.opportunity.listingContext || {}

  return `
    ${metricGrid([
      { label: 'Listing pressure', value: listing.pressureLabel || 'Needs review' },
      { label: 'Status', value: listing.status || 'Needs review' },
      { label: 'Days on market', value: listing.daysOnMarket !== null && listing.daysOnMarket !== undefined ? String(listing.daysOnMarket) : 'Needs review' },
      { label: 'Price cuts', value: listing.priceCutCount !== null && listing.priceCutCount !== undefined ? String(listing.priceCutCount) : 'Needs review' },
      { label: 'Latest reduction', value: money(listing.lastPriceCutAmount) },
      { label: 'Source URL', value: listing.sourceUrl || 'Needs review' },
    ])}
    <div class="notes">
      <h3>Screening summary</h3>
      <p class="muted">${escapeHtml(listing.summary || 'No public listing context was added for this analysis.')}</p>
      <h3>Listing signals</h3>
      ${badgeList(listing.signals || [], 'neutral')}
    </div>
  `
}


function rangeValue(low: number | null | undefined, base: number | null | undefined, high: number | null | undefined, formatter: (value: number | null | undefined) => string = money) {
  const lowText = formatter(low)
  const baseText = formatter(base)
  const highText = formatter(high)
  if (lowText === 'Needs review' && baseText === 'Needs review' && highText === 'Needs review') return 'Needs review'
  return `${lowText} - ${highText} (base ${baseText})`
}

function buildBuyerIntelligence(payload: AnalyzerReportPayload) {
  const intel = payload.opportunity.buyerIntelligence || {}
  const rent = intel.rentMarketRange || {}
  const neighborhood = intel.neighborhoodScore || {}
  const value = intel.valueRange || {}
  const repair = intel.repairRange || {}
  const offer = intel.offerRange || {}
  const rentRows = Array.isArray(intel.rentalSensitivity) ? intel.rentalSensitivity : []
  const priceRows = Array.isArray(intel.priceSensitivity) ? intel.priceSensitivity : []
  const dataSources = Array.isArray(intel.dataSources) ? intel.dataSources : []
  const osintChecks = Array.isArray(intel.osintChecks) ? intel.osintChecks : []
  const publicRecord = intel.publicRecordIntelligence || {}
  const publicSignals = Array.isArray(publicRecord.signals) ? publicRecord.signals : []
  const buyerTalkingPoints = Array.isArray(publicRecord.buyerTalkingPoints) ? publicRecord.buyerTalkingPoints : []
  const dueDiligenceNeeds = Array.isArray(intel.dueDiligenceNeeds) ? intel.dueDiligenceNeeds : []

  return `
    ${metricGrid([
      { label: 'Rent market range', value: rangeValue(rent.low, rent.base, rent.high) },
      { label: 'Rent confidence', value: rent.confidence || 'Needs review' },
      { label: 'Neighborhood score', value: neighborhood.score !== undefined ? `${neighborhood.label || 'Screening'} (${neighborhood.score}/100)` : 'Needs review' },
      { label: 'Value range', value: rangeValue(value.low, value.base, value.high) },
      { label: 'Value confidence', value: value.confidence || 'Needs review' },
      { label: 'Repair range', value: rangeValue(repair.low, repair.base, repair.high) },
      { label: 'Repair confidence', value: repair.confidence || 'Needs review' },
      { label: 'Buyer offer band', value: rangeValue(offer.low, offer.base, offer.high) },
      { label: 'Public record score', value: publicRecord.score !== undefined ? `${publicRecord.label || 'Public record'} (${publicRecord.score}/100)` : 'Needs review' },
      { label: 'Source freshness', value: publicRecord.sourceFreshness || 'Needs review' },
      { label: 'Diligence items', value: dueDiligenceNeeds.length ? String(dueDiligenceNeeds.length) : 'Needs review' },
    ])}
    <div class="notes">
      <h3>Data sources</h3>
      ${dataSources.length ? orderedList(dataSources) : '<p class="muted">No DealMachine or OSINT source metadata was attached.</p>'}
      <h3>Range notes</h3>
      ${orderedList([rent.summary, value.summary, repair.summary, offer.summary, neighborhood.summary].filter(Boolean))}
      <h3>Public record intelligence</h3>
      ${publicRecord.summary ? `<p>${publicRecord.summary}</p>` : '<p class="muted">Public-record intelligence needs source data.</p>'}
      ${buyerTalkingPoints.length ? orderedList(buyerTalkingPoints) : '<p class="muted">No buyer-facing public-record talking points were generated.</p>'}
      <h3>Public record signals</h3>
      ${publicSignals.length ? orderedList(publicSignals) : '<p class="muted">No public-record signals were attached.</p>'}
      <h3>Neighborhood screening factors</h3>
      ${orderedList(neighborhood.factors || [])}
      <h3>Rent sensitivity</h3>
      ${
        rentRows.length
          ? orderedList(rentRows.map((row: any) => `${row.label}: rent ${money(row.monthlyRent)}, NOI ${money(row.noiAnnual)}, cash flow ${money(row.monthlyCashFlow)}, DSCR ${percent(row.dscr, 'x')}, cap ${percent(row.capRatePercent)}`))
          : '<p class="muted">Rent sensitivity needs a rent input.</p>'
      }
      <h3>Price sensitivity</h3>
      ${
        priceRows.length
          ? orderedList(priceRows.map((row: any) => `${row.label}: price ${money(row.purchasePrice)}, cap ${percent(row.capRatePercent)}, DSCR ${percent(row.dscr, 'x')}, cash flow ${money(row.monthlyCashFlow)}, CoC ${percent(row.cashOnCashReturnPercent)}`))
          : '<p class="muted">Price sensitivity needs seller ask and financing inputs.</p>'
      }
      <h3>OSINT checks to run</h3>
      ${osintChecks.length ? orderedList(osintChecks) : '<p class="muted">No OSINT checklist was generated.</p>'}
      <h3>Buyer diligence prompts</h3>
      ${dueDiligenceNeeds.length ? orderedList(dueDiligenceNeeds) : '<p class="muted">No diligence prompts were generated.</p>'}
    </div>
  `
}

function buildCapitalStack(payload: AnalyzerReportPayload) {
  const { opportunity } = payload

  return `
    ${metricGrid([
      { label: 'Total project cost', value: money(opportunity.capitalStack.totalProjectCost) },
      { label: 'Senior debt', value: money(opportunity.capitalStack.seniorDebt) },
      { label: 'Private money', value: money(opportunity.capitalStack.privateMoney) },
      { label: 'Seller finance', value: money(opportunity.capitalStack.sellerFinance) },
      { label: 'Gap funding', value: money(opportunity.capitalStack.gapFunding) },
      { label: 'Operator cash', value: money(opportunity.capitalStack.operatorCash) },
      { label: 'Reserves', value: money(opportunity.capitalStack.estimatedReserves) },
      { label: 'Funding gap', value: money(opportunity.capitalStack.fundingGap) },
    ])}
    <div class="notes">
      <h3>Capital notes</h3>
      ${opportunity.capitalStack.notes?.length ? orderedList(opportunity.capitalStack.notes) : '<p class="muted">No special capital notes were generated.</p>'}
    </div>
  `
}

function buildCreativeStructures(payload: AnalyzerReportPayload) {
  const { opportunity } = payload
  return `
    <div class="offer-grid">
      ${(opportunity.creativeOffers || [])
        .map(
          (offer: any) => `
            <div class="offer-card">
              <div class="offer-title-row">
                <h3>${escapeHtml(offer.label)}</h3>
                <span class="badge badge-neutral">${escapeHtml(offer.viability)}</span>
              </div>
              <p class="muted">${escapeHtml(offer.summary)}</p>
              ${metricGrid([
                { label: 'Max price', value: money(offer.metrics.maxPriceToHitTargetCashFlow) },
                { label: 'Suggested price', value: money(offer.metrics.suggestedPurchasePrice) },
                { label: 'Cash to seller now', value: money(offer.metrics.cashToSellerNow) },
                { label: 'Cash to close', value: money(offer.metrics.cashToClose) },
                { label: 'Entry fee', value: money(offer.metrics.entryFee) },
                { label: 'Monthly payment', value: money(offer.metrics.monthlyPayment) },
                { label: 'Monthly cash flow', value: money(offer.metrics.estimatedMonthlyCashFlow) },
                { label: 'Senior debt', value: money(offer.metrics.seniorDebt) },
                { label: 'Seller carry', value: money(offer.metrics.sellerCarryBalance) },
                { label: 'Wrap/seller spread', value: money(offer.metrics.sellerMonthlySpread) },
                { label: 'Balloon balance', value: money(offer.metrics.balloonBalance) },
                { label: 'Exit LTV', value: offer.metrics.exitLoanToValuePercent !== null ? `${offer.metrics.exitLoanToValuePercent}%` : 'Needs details' },
              ])}
              <p class="muted"><strong>Trust:</strong> ${escapeHtml(offer.trustLabel || 'Needs proof')} ${Number.isFinite(offer.trustScore) ? escapeHtml(`(${offer.trustScore}/100)`) : ''}</p>
              ${offer.terms?.length ? `<div class="notes"><h3>Modeled terms</h3>${orderedList(offer.terms.slice(0, 6))}</div>` : ''}
              ${offer.guardrails?.length ? `<div class="notes"><h3>Guardrails</h3>${orderedList(offer.guardrails.slice(0, 5))}</div>` : ''}
              ${offer.caution ? `<p class="warning">${escapeHtml(offer.caution)}</p>` : ''}
            </div>
          `
        )
        .join('')}
    </div>
  `
}

function buildRouteFit(payload: AnalyzerReportPayload) {
  const { opportunity } = payload
  return `
    <div class="route-list">
      ${(opportunity.routeFit || [])
        .map(
          (route: any) => `
            <div class="route-item">
              <div class="route-head">
                <strong>${escapeHtml(route.label)}</strong>
                <span>${escapeHtml(`${route.score}/100`)}</span>
              </div>
              <p class="muted">${escapeHtml(route.summary)}</p>
            </div>
          `
        )
        .join('')}
    </div>
  `
}

function buildBorrowerAndFile(payload: AnalyzerReportPayload) {
  const { form, opportunity } = payload

  return `
    ${metricGrid([
      { label: 'Credit range', value: form.creditScoreRange || 'Needs review' },
      { label: 'Entity status', value: form.entityStatus || 'Needs review' },
      { label: 'Experience', value: form.realEstateExperience || 'Needs review' },
      { label: 'Funding path', value: opportunity.fundingReadiness.recommendedPath || 'Needs review' },
    ])}
    <div class="notes">
      <h3>Missing file items</h3>
      ${badgeList(opportunity.fundingReadiness.missingItems || [], 'warning')}
      <h3>Risk flags</h3>
      ${badgeList(opportunity.riskFlags || [], 'danger')}
    </div>
  `
}

function buildBuilderLane(payload: AnalyzerReportPayload) {
  const lane = payload.opportunity.builderDisposition || {}

  return `
    ${metricGrid([
      { label: 'Builder lane score', value: `${lane.score ?? 'Needs review'}/100` },
      { label: 'Builder max purchase', value: money(lane.builderMaxPurchase) },
      { label: 'Seller offer target', value: money(lane.recommendedSellerOffer) },
      { label: 'Suggested assignment fee', value: money(lane.suggestedAssignmentFee) },
      { label: 'Projected gross spread', value: money(lane.projectedGrossSpread) },
      { label: 'Renovation scope', value: lane.renovationScope || 'Needs review' },
    ])}
    <div class="notes">
      <h3>Seller angle</h3>
      <p class="muted">${escapeHtml(lane.sellerOutreachAngle || 'Confirm price, title, and access before route decisions are made.')}</p>
      <h3>Builder buy-box questions</h3>
      ${orderedList(lane.buyBoxQuestions || [])}
      <h3>Next steps</h3>
      ${orderedList(lane.nextSteps || [])}
    </div>
  `
}

function buildAssignmentContractDraft(payload: AnalyzerReportPayload) {
  const lane = payload.opportunity.builderDisposition || {}
  const purchasePrice = lane.recommendedSellerOffer
  const fee = lane.suggestedAssignmentFee
  const builderPrice =
    lane.builderMaxPurchase !== null && lane.builderMaxPurchase !== undefined
      ? lane.builderMaxPurchase
      : purchasePrice !== null && fee !== null
        ? purchasePrice + fee
        : null

  return `
    <div class="notes">
      <h3>Draft parties</h3>
      <p>Assignor: VestBlock or its assigns</p>
      <p>Assignee: ________________________________</p>
      <p>Seller / original contract party: ________________________________</p>
      <h3>Property</h3>
      <p>${escapeHtml(payload.address)}</p>
      <h3>Economic terms</h3>
      ${metricGrid([
        { label: 'Original contract price', value: money(purchasePrice) },
        { label: 'Assignment fee', value: money(fee) },
        { label: 'Assignee total purchase', value: money(builderPrice) },
        { label: 'Earnest money', value: money(lane.contractTerms?.earnestMoney) },
        { label: 'Inspection period', value: `${lane.contractTerms?.inspectionDays ?? 'Needs review'} days` },
        { label: 'Close window', value: `${lane.contractTerms?.closeWindowDays ?? 'Needs review'} days` },
      ])}
      <h3>Suggested draft language</h3>
      ${orderedList([
        'Assignor agrees to assign its equitable interest in the underlying purchase agreement for the property listed above to Assignee.',
        'Assignee agrees to pay the assignment fee at closing in immediately available funds pursuant to the closing statement or escrow instructions.',
        'Assignee acknowledges responsibility for its own inspections, due diligence, contractor review, title review, financing, and final underwriting.',
        'Any earnest money, close window, extension rights, and access terms should match the underlying purchase agreement unless amended in writing by the parties.',
        'This draft is an internal planning document only until local counsel or the closing company confirms the final assignment language.',
      ])}
    </div>
  `
}

export function buildAnalyzerReportHtml(payload: AnalyzerReportPayload) {
  const heading = reportHeading(payload.reportType)
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading.title)}</title>
    <style>
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: #060b16; color: #e8eef8; }
      .page { max-width: 980px; margin: 0 auto; padding: 40px 28px 56px; }
      .hero { border: 1px solid rgba(103,232,249,0.16); background: linear-gradient(135deg, rgba(14,116,144,0.22), rgba(15,23,42,0.88)); border-radius: 24px; padding: 28px; box-shadow: 0 24px 80px rgba(2,6,23,0.28); }
      h1 { margin: 0; font-size: 32px; line-height: 1.1; }
      h2 { margin: 0 0 14px; font-size: 18px; color: #f8fafc; }
      h3 { margin: 16px 0 10px; font-size: 14px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.08em; }
      p { line-height: 1.6; }
      .lead { font-size: 16px; color: #f8fafc; }
      .muted { color: #a9b7cc; }
      .meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 14px; font-size: 13px; color: #c7d2e4; }
      .section { margin-top: 20px; border: 1px solid rgba(255,255,255,0.08); background: rgba(15,23,42,0.7); border-radius: 20px; padding: 22px; }
      .metrics { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px; }
      .metric { border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px; background: rgba(255,255,255,0.03); }
      .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #92a3bb; }
      .metric-value { margin-top: 8px; font-size: 16px; font-weight: 600; color: #f8fafc; }
      .badge-list { display: flex; flex-wrap: wrap; gap: 8px; }
      .badge { display: inline-flex; padding: 7px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); font-size: 12px; }
      .badge-neutral { background: rgba(255,255,255,0.06); color: #e2e8f0; }
      .badge-warning { background: rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.18); color: #fde68a; }
      .badge-danger { background: rgba(251,113,133,0.12); border-color: rgba(251,113,133,0.18); color: #fecdd3; }
      .list { margin: 0; padding-left: 18px; color: #d9e3f3; }
      .list li { margin-bottom: 8px; }
      .offer-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
      .offer-card { border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 16px; background: rgba(255,255,255,0.03); }
      .offer-title-row, .route-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .route-list { display: grid; gap: 12px; }
      .route-item { border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 14px; background: rgba(255,255,255,0.03); }
      .warning { margin-top: 12px; color: #fde68a; }
      .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; }
      @media (max-width: 860px) {
        .metrics, .offer-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hero">
        <h1>${escapeHtml(heading.title)}</h1>
        <p class="lead">${escapeHtml(heading.subtitle)}</p>
        <div class="meta">
          <span><strong>Address:</strong> ${escapeHtml(payload.address)}</span>
          <span><strong>Generated:</strong> ${escapeHtml(generatedAt)}</span>
          <span><strong>VestBlock:</strong> Deal routing, capital review, and investor intelligence</span>
        </div>
      </div>

      ${section('Summary', `${buildSummaryCopy(payload)}${metricGrid(buildTopMetrics(payload))}`)}
      ${
        payload.reportType === 'assignment_contract'
          ? section('Assignment Draft', buildAssignmentContractDraft(payload))
          : [
              section('Property Snapshot', buildPropertyFacts(payload)),
              section('Comparables And Listing Context', `${buildComparableContext(payload)}${buildListingContext(payload)}`),
              payload.reportType === 'buyer' ? section('Buyer Range Intelligence', buildBuyerIntelligence(payload)) : null,
              payload.reportType === 'builder' ? section('Builder Lane', buildBuilderLane(payload)) : section('Financial Overview', buildFinancialOverview(payload)),
              payload.reportType === 'builder' ? section('Financial Overview', buildFinancialOverview(payload)) : section('Capital Stack', buildCapitalStack(payload)),
              payload.reportType === 'builder' ? section('Capital Stack', buildCapitalStack(payload)) : section('Borrower And File Readiness', buildBorrowerAndFile(payload)),
              payload.reportType === 'builder' ? section('Borrower And File Readiness', buildBorrowerAndFile(payload)) : section('Routing Signals', buildRouteFit(payload)),
              payload.reportType === 'builder' ? section('Routing Signals', buildRouteFit(payload)) : section('Creative Structures', buildCreativeStructures(payload)),
              payload.reportType === 'builder'
                ? section('Creative Structures', buildCreativeStructures(payload))
                : null,
              section('Recommended Next Steps', orderedList(payload.reportType === 'builder' ? payload.opportunity.builderDisposition?.nextSteps || payload.opportunity.nextSteps || [] : payload.opportunity.nextSteps || [])),
            ]
              .filter(Boolean)
              .join('')
      }

      <div class="footer">
        ${escapeHtml(
          payload.opportunity.disclaimer ||
            'VestBlock provides informational analysis, deal estimates, funding readiness guidance, and referral routing support. All numbers require independent verification.'
        )}
      </div>
    </div>
  </body>
</html>`
}
