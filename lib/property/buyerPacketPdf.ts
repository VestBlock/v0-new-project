import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { AnalyzerReportPayload } from '@/lib/property/reportGenerator'

type BuyerPacketPdfInput = AnalyzerReportPayload & {
  buyerName?: string | null
  packetTitle?: string | null
}

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 44
const INK = rgb(0.91, 0.96, 1)
const MUTED = rgb(0.58, 0.67, 0.76)
const CYAN = rgb(0.23, 0.87, 0.96)
const GREEN = rgb(0.32, 0.91, 0.64)
const AMBER = rgb(0.98, 0.74, 0.25)
const DARK = rgb(0.03, 0.06, 0.12)
const PANEL = rgb(0.07, 0.1, 0.18)
const PANEL_2 = rgb(0.1, 0.14, 0.23)

function toNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function money(value: unknown) {
  const parsed = toNumber(value)
  if (parsed === null) return 'Needs review'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(parsed)
}

function percent(value: unknown, suffix = '%') {
  const parsed = toNumber(value)
  if (parsed === null) return 'Needs review'
  return `${parsed}${suffix}`
}

function safeText(value: unknown) {
  return String(value ?? '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .trim()
}

function packetFileStem(address: string) {
  const stem = safeText(address)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return `vestblock-buyer-packet-${stem || 'property'}`
}

export function buildBuyerPacketFileName(address: string) {
  return `${packetFileStem(address)}.pdf`
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safeText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : ['Needs review']
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: { font: PDFFont; size: number; color?: ReturnType<typeof rgb>; maxWidth: number; lineHeight?: number }
) {
  const lineHeight = options.lineHeight ?? options.size + 5
  const lines = wrapText(text, options.font, options.size, options.maxWidth)
  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      size: options.size,
      font: options.font,
      color: options.color ?? INK,
    })
  })
  return y - lines.length * lineHeight
}

function drawPill(page: PDFPage, text: string, x: number, y: number, font: PDFFont, color = CYAN) {
  const label = safeText(text)
  const width = Math.max(72, font.widthOfTextAtSize(label, 9) + 22)
  page.drawRectangle({ x, y: y - 4, width, height: 20, color: rgb(0.06, 0.15, 0.22), borderColor: color, borderWidth: 0.7 })
  page.drawText(label, { x: x + 11, y: y + 2, size: 9, font, color })
  return width
}

function drawMetric(
  page: PDFPage,
  input: { label: string; value: string; x: number; y: number; width: number; font: PDFFont; bold: PDFFont; color?: ReturnType<typeof rgb> }
) {
  page.drawRectangle({
    x: input.x,
    y: input.y - 58,
    width: input.width,
    height: 58,
    color: PANEL_2,
    borderColor: rgb(0.13, 0.2, 0.3),
    borderWidth: 0.8,
  })
  page.drawText(safeText(input.label).toUpperCase(), {
    x: input.x + 12,
    y: input.y - 20,
    size: 7,
    font: input.font,
    color: MUTED,
  })
  drawWrapped(page, input.value, input.x + 12, input.y - 38, {
    font: input.bold,
    size: 12,
    color: input.color ?? INK,
    maxWidth: input.width - 24,
    lineHeight: 13,
  })
}

function drawSectionTitle(page: PDFPage, title: string, x: number, y: number, font: PDFFont) {
  page.drawText(safeText(title).toUpperCase(), { x, y, size: 9, font, color: CYAN })
  page.drawLine({ start: { x, y: y - 8 }, end: { x: PAGE_WIDTH - MARGIN, y: y - 8 }, thickness: 0.8, color: rgb(0.12, 0.23, 0.32) })
}

function addPage(doc: PDFDocument) {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: DARK })
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 84, width: PAGE_WIDTH, height: 84, color: rgb(0.04, 0.11, 0.18) })
  page.drawRectangle({ x: MARGIN, y: 40, width: PAGE_WIDTH - MARGIN * 2, height: PAGE_HEIGHT - 106, color: PANEL, opacity: 0.22 })
  return page
}


function rangeText(low: unknown, base: unknown, high: unknown, formatter = money) {
  const lowText = formatter(low)
  const baseText = formatter(base)
  const highText = formatter(high)
  if (lowText === 'Needs review' && baseText === 'Needs review' && highText === 'Needs review') return 'Needs review'
  return `${lowText} - ${highText} | base ${baseText}`
}

function drawBullets(
  page: PDFPage,
  items: string[],
  x: number,
  y: number,
  options: { font: PDFFont; size: number; color?: ReturnType<typeof rgb>; maxWidth: number; lineHeight?: number; limit?: number }
) {
  let nextY = y
  const limit = options.limit ?? items.length
  for (const item of items.map(safeText).filter(Boolean).slice(0, limit)) {
    page.drawCircle({ x: x + 4, y: nextY + 3, size: 2.2, color: CYAN })
    nextY = drawWrapped(page, item, x + 14, nextY, {
      font: options.font,
      size: options.size,
      color: options.color ?? INK,
      maxWidth: options.maxWidth - 14,
      lineHeight: options.lineHeight ?? options.size + 4,
    })
    nextY -= 4
  }
  return nextY
}

function bestRoute(opportunity: any) {
  const routes = Array.isArray(opportunity?.routeFit) ? [...opportunity.routeFit] : []
  return routes.sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))[0] || null
}

function selectedComps(opportunity: any) {
  const comps = opportunity?.comparables?.selected
  return Array.isArray(comps) ? comps.filter((comp) => comp?.salePrice).slice(0, 6) : []
}

function topNextSteps(opportunity: any) {
  const builder = opportunity?.builderDisposition?.nextSteps
  const general = opportunity?.nextSteps
  const steps = Array.isArray(builder) && builder.length ? builder : Array.isArray(general) ? general : []
  return steps.map(safeText).filter(Boolean).slice(0, 6)
}

export async function buildPremiumBuyerPacketPdf(input: BuyerPacketPdfInput): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)
  const address = safeText(input.address || 'Property opportunity')
  const opportunity = input.opportunity || {}
  const estimate = input.estimate || {}
  const form = (input.form || {}) as Record<string, unknown>
  const route = bestRoute(opportunity)
  const generatedAt = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const cover = addPage(doc)
  cover.drawText('VESTBLOCK', { x: MARGIN, y: PAGE_HEIGHT - 56, size: 16, font: bold, color: CYAN })
  cover.drawText('BUYER DEAL PACKET', { x: PAGE_WIDTH - 220, y: PAGE_HEIGHT - 54, size: 10, font: mono, color: MUTED })
  cover.drawCircle({ x: PAGE_WIDTH - 84, y: PAGE_HEIGHT - 44, size: 19, color: rgb(0.05, 0.24, 0.31), borderColor: CYAN, borderWidth: 1 })
  cover.drawCircle({ x: PAGE_WIDTH - 84, y: PAGE_HEIGHT - 44, size: 8, color: CYAN, opacity: 0.8 })

  let y = PAGE_HEIGHT - 138
  drawPill(cover, input.buyerName ? `Prepared for ${input.buyerName}` : 'Disposition ready', MARGIN, y, regular)
  y -= 46
  y = drawWrapped(cover, input.packetTitle || 'Premium Buyer Opportunity', MARGIN, y, {
    font: bold,
    size: 32,
    color: INK,
    maxWidth: PAGE_WIDTH - MARGIN * 2,
    lineHeight: 36,
  })
  y -= 12
  y = drawWrapped(cover, address, MARGIN, y, {
    font: regular,
    size: 17,
    color: CYAN,
    maxWidth: PAGE_WIDTH - MARGIN * 2,
    lineHeight: 22,
  })
  y -= 24
  y = drawWrapped(
    cover,
    opportunity?.buyerInterest?.summary ||
      'This packet summarizes VestBlock screening, valuation context, buyer fit, route logic, and diligence items for a fast buyer review.',
    MARGIN,
    y,
    { font: regular, size: 11, color: rgb(0.76, 0.84, 0.92), maxWidth: PAGE_WIDTH - MARGIN * 2, lineHeight: 16 }
  )

  const metricY = 430
  const metricWidth = (PAGE_WIDTH - MARGIN * 2 - 24) / 3
  const metrics = [
    { label: 'ARV', value: money(opportunity?.metrics?.arv), color: CYAN },
    { label: 'Repair budget', value: money(opportunity?.metrics?.repairBudget), color: AMBER },
    { label: 'Buyer fit', value: `${safeText(opportunity?.buyerInterest?.label || 'Needs review')} (${opportunity?.buyerInterest?.score ?? 'NA'}/100)`, color: GREEN },
    { label: 'MAO', value: money(opportunity?.dealMath?.mao ?? opportunity?.metrics?.mao70), color: CYAN },
    { label: 'End-buyer profit', value: money(opportunity?.dealMath?.endBuyerProfit), color: GREEN },
    { label: 'Primary route', value: safeText(route?.label || opportunity?.builderDisposition?.label || 'Route pending'), color: INK },
  ]
  metrics.forEach((metric, index) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    drawMetric(cover, {
      ...metric,
      x: MARGIN + col * (metricWidth + 12),
      y: metricY - row * 72,
      width: metricWidth,
      font: regular,
      bold,
    })
  })

  cover.drawRectangle({ x: MARGIN, y: 96, width: PAGE_WIDTH - MARGIN * 2, height: 78, color: rgb(0.04, 0.12, 0.18), borderColor: rgb(0.14, 0.32, 0.4), borderWidth: 1 })
  drawWrapped(
    cover,
    'Buyer CTA: Reply with interest level, preferred purchase range, close timeline, proof-of-funds status, and any diligence questions needed before a live assignment conversation.',
    MARGIN + 18,
    142,
    { font: regular, size: 11, color: INK, maxWidth: PAGE_WIDTH - MARGIN * 2 - 36, lineHeight: 16 }
  )
  cover.drawText(`Generated ${generatedAt}`, { x: MARGIN, y: 58, size: 8, font: mono, color: MUTED })

  const page2 = addPage(doc)
  page2.drawText('VESTBLOCK', { x: MARGIN, y: PAGE_HEIGHT - 56, size: 14, font: bold, color: CYAN })
  drawSectionTitle(page2, 'Property and underwriting snapshot', MARGIN, PAGE_HEIGHT - 120, bold)
  const facts = [
    { label: 'Property type', value: safeText(form.propertyType || 'Needs review') },
    { label: 'Condition', value: safeText(form.propertyCondition || 'Needs review') },
    { label: 'Occupancy', value: safeText(form.occupancyStatus || 'Needs review') },
    { label: 'Seller timeline', value: safeText(form.timelineToSell || 'Needs review') },
    { label: 'Asking price', value: money(estimate.askingPrice ?? opportunity?.dealMath?.sellerAsk) },
    { label: 'Rent range', value: rangeText(opportunity?.buyerIntelligence?.rentMarketRange?.low, opportunity?.buyerIntelligence?.rentMarketRange?.base ?? estimate.rentEstimate, opportunity?.buyerIntelligence?.rentMarketRange?.high) },
    { label: 'Cash review', value: `${money(opportunity?.metrics?.conservativeCashReview)} to ${money(opportunity?.metrics?.balancedCashReview)}` },
    { label: 'DSCR', value: percent(opportunity?.metrics?.dscr, 'x') },
    { label: 'Cap rate', value: percent(opportunity?.metrics?.capRatePercent) },
  ]
  facts.forEach((metric, index) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    drawMetric(page2, {
      ...metric,
      x: MARGIN + col * (metricWidth + 12),
      y: PAGE_HEIGHT - 150 - row * 72,
      width: metricWidth,
      font: regular,
      bold,
    })
  })

  drawSectionTitle(page2, 'Comps and listing pressure', MARGIN, 396, bold)
  const comps = selectedComps(opportunity)
  let compY = 368
  if (comps.length) {
    for (const comp of comps) {
      const line = [
        safeText(comp.address || 'Comp address pending'),
        money(comp.salePrice),
        comp.squareFeet ? `${comp.squareFeet} sqft` : null,
        comp.distanceMiles ? `${comp.distanceMiles} mi` : null,
        comp.pricePerFoot ? `$${comp.pricePerFoot}/sqft` : null,
      ]
        .filter(Boolean)
        .join('  |  ')
      compY = drawWrapped(page2, line, MARGIN + 10, compY, {
        font: regular,
        size: 9,
        color: rgb(0.78, 0.86, 0.94),
        maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
        lineHeight: 13,
      })
      compY -= 3
    }
  } else {
    compY = drawWrapped(page2, 'No sold comps were entered. Treat value as a screening range until comps are verified.', MARGIN + 10, compY, {
      font: regular,
      size: 10,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
    })
  }
  compY -= 12
  drawWrapped(page2, opportunity?.listingContext?.summary || 'No listing pressure context was entered for this analysis.', MARGIN + 10, compY, {
    font: regular,
    size: 10,
    color: MUTED,
    maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
    lineHeight: 15,
  })



  const intel = opportunity?.buyerIntelligence || {}
  const pageIntel = addPage(doc)
  pageIntel.drawText('VESTBLOCK', { x: MARGIN, y: PAGE_HEIGHT - 56, size: 14, font: bold, color: CYAN })
  drawSectionTitle(pageIntel, 'Buyer range intelligence', MARGIN, PAGE_HEIGHT - 120, bold)
  const intelMetrics = [
    { label: 'Rent market range', value: rangeText(intel?.rentMarketRange?.low, intel?.rentMarketRange?.base, intel?.rentMarketRange?.high), color: GREEN },
    { label: 'Neighborhood score', value: intel?.neighborhoodScore?.score !== undefined ? `${safeText(intel.neighborhoodScore.label)} (${intel.neighborhoodScore.score}/100)` : 'Needs review', color: CYAN },
    { label: 'Value range', value: rangeText(intel?.valueRange?.low, intel?.valueRange?.base, intel?.valueRange?.high), color: INK },
    { label: 'Repair range', value: rangeText(intel?.repairRange?.low, intel?.repairRange?.base, intel?.repairRange?.high), color: AMBER },
    { label: 'Buyer offer band', value: rangeText(intel?.offerRange?.low, intel?.offerRange?.base, intel?.offerRange?.high), color: CYAN },
    { label: 'Range confidence', value: `${safeText(intel?.rentMarketRange?.confidence || 'Needs rent')} / ${safeText(intel?.valueRange?.confidence || 'Needs value')}`, color: MUTED },
  ]
  intelMetrics.forEach((metric, index) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    drawMetric(pageIntel, {
      ...metric,
      x: MARGIN + col * (metricWidth + 12),
      y: PAGE_HEIGHT - 150 - row * 72,
      width: metricWidth,
      font: regular,
      bold,
    })
  })

  drawSectionTitle(pageIntel, 'DealMachine, OSINT, and data date', MARGIN, 500, bold)
  let dataY = 472
  dataY = drawBullets(pageIntel, Array.isArray(intel?.dataSources) ? intel.dataSources : [], MARGIN + 4, dataY, {
    font: regular,
    size: 8.5,
    color: rgb(0.78, 0.86, 0.94),
    maxWidth: PAGE_WIDTH - MARGIN * 2 - 8,
    lineHeight: 11,
    limit: 6,
  })
  if (!Array.isArray(intel?.dataSources) || !intel.dataSources.length) {
    dataY = drawWrapped(pageIntel, 'No DealMachine or OSINT source metadata was attached to this analysis.', MARGIN + 10, dataY, {
      font: regular,
      size: 9,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
    })
  }

  drawSectionTitle(pageIntel, 'Rent sensitivity', MARGIN, 374, bold)
  let sensitivityY = 346
  const rentRows = Array.isArray(intel?.rentalSensitivity) ? intel.rentalSensitivity.slice(0, 3) : []
  if (rentRows.length) {
    for (const row of rentRows) {
      const line = `${safeText(row.label)} | Rent ${money(row.monthlyRent)} | NOI ${money(row.noiAnnual)} | Cash flow ${money(row.monthlyCashFlow)} | DSCR ${percent(row.dscr, 'x')} | Cap ${percent(row.capRatePercent)}`
      sensitivityY = drawWrapped(pageIntel, line, MARGIN + 10, sensitivityY, {
        font: regular,
        size: 8.5,
        color: rgb(0.78, 0.86, 0.94),
        maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
        lineHeight: 12,
      })
      sensitivityY -= 5
    }
  } else {
    sensitivityY = drawWrapped(pageIntel, 'Rent sensitivity needs a rent input or verified lease data.', MARGIN + 10, sensitivityY, {
      font: regular,
      size: 10,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
    })
  }

  drawSectionTitle(pageIntel, 'Price sensitivity', MARGIN, 236, bold)
  let priceY = 208
  const priceRows = Array.isArray(intel?.priceSensitivity) ? intel.priceSensitivity.slice(0, 3) : []
  for (const row of priceRows) {
    const line = `${safeText(row.label)} | Price ${money(row.purchasePrice)} | Cap ${percent(row.capRatePercent)} | DSCR ${percent(row.dscr, 'x')} | Cash flow ${money(row.monthlyCashFlow)} | CoC ${percent(row.cashOnCashReturnPercent)}`
    priceY = drawWrapped(pageIntel, line, MARGIN + 10, priceY, {
      font: regular,
      size: 8.5,
      color: rgb(0.78, 0.86, 0.94),
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
      lineHeight: 12,
    })
    priceY -= 5
  }

  drawSectionTitle(pageIntel, 'OSINT checks to run', MARGIN, 116, bold)
  drawBullets(pageIntel, Array.isArray(intel?.osintChecks) ? intel.osintChecks : [], MARGIN + 4, 92, {
    font: regular,
    size: 7.3,
    color: MUTED,
    maxWidth: PAGE_WIDTH - MARGIN * 2 - 8,
    lineHeight: 9,
    limit: 6,
  })

  const page3 = addPage(doc)
  page3.drawText('VESTBLOCK', { x: MARGIN, y: PAGE_HEIGHT - 56, size: 14, font: bold, color: CYAN })
  drawSectionTitle(page3, 'Buyer route, risks, and next move', MARGIN, PAGE_HEIGHT - 120, bold)
  let routeY = PAGE_HEIGHT - 152
  const routes = Array.isArray(opportunity?.routeFit) ? opportunity.routeFit.slice(0, 5) : []
  if (routes.length) {
    for (const item of routes) {
      page3.drawRectangle({ x: MARGIN, y: routeY - 48, width: PAGE_WIDTH - MARGIN * 2, height: 48, color: PANEL_2, borderColor: rgb(0.13, 0.2, 0.3), borderWidth: 0.8 })
      page3.drawText(safeText(item.label || 'Route'), { x: MARGIN + 12, y: routeY - 18, size: 11, font: bold, color: INK })
      page3.drawText(`${Number(item.score || 0)}/100`, { x: PAGE_WIDTH - MARGIN - 48, y: routeY - 18, size: 10, font: mono, color: CYAN })
      drawWrapped(page3, item.summary || 'Route needs review.', MARGIN + 12, routeY - 34, {
        font: regular,
        size: 8.5,
        color: MUTED,
        maxWidth: PAGE_WIDTH - MARGIN * 2 - 76,
        lineHeight: 10,
      })
      routeY -= 60
    }
  } else {
    routeY = drawWrapped(page3, 'No route stack was generated. Re-run the analyzer after adding ARV, repair, rent, and seller timeline inputs.', MARGIN, routeY, {
      font: regular,
      size: 10,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    })
  }

  drawSectionTitle(page3, 'Risk flags', MARGIN, 346, bold)
  const riskFlags = Array.isArray(opportunity?.riskFlags) ? opportunity.riskFlags.map(safeText).filter(Boolean).slice(0, 8) : []
  let riskY = 318
  if (riskFlags.length) {
    for (const flag of riskFlags) {
      page3.drawCircle({ x: MARGIN + 5, y: riskY + 3, size: 2.4, color: AMBER })
      riskY = drawWrapped(page3, flag, MARGIN + 16, riskY, {
        font: regular,
        size: 9.5,
        color: rgb(0.9, 0.82, 0.64),
        maxWidth: PAGE_WIDTH - MARGIN * 2 - 20,
        lineHeight: 13,
      })
      riskY -= 3
    }
  } else {
    riskY = drawWrapped(page3, 'No major risk flags surfaced from this pass.', MARGIN, riskY, {
      font: regular,
      size: 10,
      color: MUTED,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    })
  }

  drawSectionTitle(page3, 'Next steps', MARGIN, 196, bold)
  let stepY = 168
  const steps = topNextSteps(opportunity)
  for (const [index, step] of (steps.length ? steps : ['Confirm access, photos, title status, taxes, occupancy, and buyer price before assignment.']).entries()) {
    page3.drawText(`${index + 1}.`, { x: MARGIN, y: stepY, size: 10, font: bold, color: CYAN })
    stepY = drawWrapped(page3, step, MARGIN + 22, stepY, {
      font: regular,
      size: 9.5,
      color: INK,
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 22,
      lineHeight: 13,
    })
    stepY -= 5
  }

  page3.drawRectangle({ x: MARGIN, y: 46, width: PAGE_WIDTH - MARGIN * 2, height: 52, color: rgb(0.04, 0.09, 0.14), borderColor: rgb(0.16, 0.24, 0.32), borderWidth: 0.8 })
  drawWrapped(
    page3,
    opportunity?.disclaimer ||
      'VestBlock provides screening estimates and deal-routing support only. Buyer must verify all condition, title, occupancy, rent, tax, insurance, lender, and legal details before relying on any numbers.',
    MARGIN + 12,
    78,
    { font: regular, size: 7.5, color: MUTED, maxWidth: PAGE_WIDTH - MARGIN * 2 - 24, lineHeight: 10 }
  )

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
