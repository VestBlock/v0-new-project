export type AnalyzerReportType = 'investor' | 'buyer' | 'lender'

export type AnalyzerReportPayload = {
  reportType: AnalyzerReportType
  address: string
  form: Record<string, string>
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

  return {
    title: 'VestBlock Investor Deal Report',
    subtitle: 'Deal math, route fit, and risk framing based on the current analyzer inputs.',
  }
}

function buildTopMetrics(payload: AnalyzerReportPayload) {
  const { estimate, opportunity, reportType } = payload

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
    { label: 'Cash on cash', value: percent(opportunity.metrics.cashOnCashReturnPercent) },
  ]
}

function buildSummaryCopy(payload: AnalyzerReportPayload) {
  const { opportunity, reportType } = payload

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

  return metricGrid([
    { label: 'Address', value: payload.address },
    { label: 'Property type', value: form.propertyType || 'Needs review' },
    { label: 'Condition', value: form.propertyCondition || 'Needs review' },
    { label: 'Occupancy', value: form.occupancyStatus || 'Needs review' },
    { label: 'Timeline', value: form.timelineToSell || 'Needs review' },
    { label: 'Exit strategy', value: form.exitStrategy || 'Needs review' },
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
    { label: 'Cash on cash', value: percent(opportunity.metrics.cashOnCashReturnPercent) },
  ])
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
                { label: 'Monthly payment', value: money(offer.metrics.monthlyPayment) },
                { label: 'Monthly cash flow', value: money(offer.metrics.estimatedMonthlyCashFlow) },
              ])}
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
      ${section('Property Snapshot', buildPropertyFacts(payload))}
      ${section('Financial Overview', buildFinancialOverview(payload))}
      ${section('Capital Stack', buildCapitalStack(payload))}
      ${section('Borrower And File Readiness', buildBorrowerAndFile(payload))}
      ${section('Routing Signals', buildRouteFit(payload))}
      ${section('Creative Structures', buildCreativeStructures(payload))}
      ${section('Recommended Next Steps', orderedList(payload.opportunity.nextSteps || []))}

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
