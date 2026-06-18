#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const root = process.cwd()
const dataPath = path.join(root, 'data/property-portfolios/milwaukee-10-unit-duplex-portfolio.json')
const workflowPath = path.join(root, 'data/property-portfolios/milwaukee-10-unit-duplex-portfolio.workflow.json')
const photoDir = path.join(root, 'reports/neville-milwaukee-portfolio')

const portfolio = JSON.parse(await fs.readFile(dataPath, 'utf8'))
const workflow = JSON.parse(await fs.readFile(workflowPath, 'utf8'))
const outPath = path.join(root, portfolio.buyerPacketPath)

const dealMachineFacts = {
  '3425-3427-n-11th-st': { publicValue: 144000, equityIndicator: '67% estimated equity', bedsBaths: '8 beds / 2 baths', squareFeet: 2618, yearBuilt: '1923', lot: '0.09 acres', taxStatus: '2024 taxes shown current', annualTax: 1621, repairEstimate: 91630, photo: 'photos/duplex-a-redacted.png', note: 'Vacancy indicator present in DealMachine; verify occupancy before marketing as stabilized.' },
  '2119-2121-n-34th-st': { publicValue: 73000, equityIndicator: '100% estimated equity', bedsBaths: '6 beds / 2 baths', squareFeet: 2613, yearBuilt: 'Not shown in DealMachine panel', lot: 'Not shown', taxStatus: 'Tax detail not shown in captured panel', annualTax: null, repairEstimate: 91455, photo: 'photos/duplex-b-redacted.png', note: 'DealMachine panel showed a free-and-clear/high-equity signal; verify title before relying on it.' },
  '2954-n-24th-pl': { publicValue: 101000, equityIndicator: '100% estimated equity', bedsBaths: '4 beds / 2 baths', squareFeet: 1721, yearBuilt: '1913', lot: '0.08 acres', taxStatus: '2024 taxes shown current', annualTax: 891, repairEstimate: 60235, photo: null, note: 'Need fresh interior photos before sending final diligence to buyers.' },
  '3533-n-1st-st': { publicValue: 79000, equityIndicator: '100% estimated equity', bedsBaths: '4 beds / 2 baths', squareFeet: 1812, yearBuilt: '1910', lot: '0.05 acres', taxStatus: '2024 taxes shown current', annualTax: 1239, repairEstimate: 63420, photo: 'photos/duplex-d-redacted.png', note: 'Public value and seller rent require comp validation before quoting investor upside.' },
  '2421-2423-n-35th-st': { publicValue: 130000, equityIndicator: '100% estimated equity', bedsBaths: '4 beds / 2 baths', squareFeet: 2264, yearBuilt: '1921', lot: '0.11 acres', taxStatus: '2024 taxes shown current', annualTax: 1719, repairEstimate: 79240, photo: null, note: 'Verify rent, condition, and unit mix before releasing final underwriting.' },
}

const dollars = (value) => value === null || value === undefined || Number.isNaN(Number(value)) ? 'TBD' : `$${Math.round(Number(value)).toLocaleString('en-US')}`
const number = (value) => value === null || value === undefined || Number.isNaN(Number(value)) ? 'TBD' : Number(value).toLocaleString('en-US')
const pct = (value) => `${Number(value).toFixed(2)}%`
const rentRange = (rent) => `${dollars(Number(rent) * 0.9)} - ${dollars(Number(rent) * 1.12)}`

const pdfDoc = await PDFDocument.create()
const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
const mono = await pdfDoc.embedFont(StandardFonts.Courier)

const ink = rgb(0.1, 0.14, 0.16)
const muted = rgb(0.39, 0.45, 0.49)
const dark = rgb(0.04, 0.08, 0.11)
const navy = rgb(0.06, 0.11, 0.16)
const teal = rgb(0.0, 0.55, 0.56)
const line = rgb(0.82, 0.86, 0.88)
const pale = rgb(0.94, 0.98, 0.97)
const white = rgb(1, 1, 1)

function safeText(value) {
  return String(value ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '').trim()
}

function addPage() {
  const page = pdfDoc.addPage([612, 792])
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.985, 0.985, 0.975) })
  return page
}

function drawText(page, text, x, y, opts = {}) {
  page.drawText(safeText(text), { x, y, size: opts.size ?? 10, font: opts.font ?? regular, color: opts.color ?? ink })
}

function wrapText(text, maxWidth, size, font = regular) {
  const words = safeText(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next
    else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['TBD']
}

function drawWrapped(page, text, x, y, maxWidth, opts = {}) {
  const size = opts.size ?? 10
  const font = opts.font ?? regular
  const leading = opts.leading ?? size + 4
  const lines = wrapText(text, maxWidth, size, font)
  lines.forEach((lineText, index) => drawText(page, lineText, x, y - index * leading, { ...opts, font, size }))
  return y - lines.length * leading
}

function section(page, title, y) {
  drawText(page, title.toUpperCase(), 44, y, { font: bold, size: 10, color: teal })
  page.drawLine({ start: { x: 44, y: y - 8 }, end: { x: 568, y: y - 8 }, thickness: 1, color: line })
}

function metric(page, label, value, x, y, w = 120) {
  page.drawRectangle({ x, y, width: w, height: 58, color: white, borderColor: line, borderWidth: 1 })
  drawText(page, label.toUpperCase(), x + 10, y + 37, { font: bold, size: 7.2, color: muted })
  drawWrapped(page, value, x + 10, y + 19, w - 20, { font: bold, size: 13, leading: 13, color: dark })
}

function table(page, rows, x, y, widths, opts = {}) {
  const rowH = opts.rowH ?? 24
  rows.forEach((row, rowIndex) => {
    let cx = x
    page.drawRectangle({ x, y: y - rowIndex * rowH, width: widths.reduce((sum, width) => sum + width, 0), height: rowH, color: rowIndex === 0 ? navy : rowIndex % 2 ? white : rgb(0.965, 0.975, 0.975), borderColor: line, borderWidth: 0.5 })
    row.forEach((cell, cellIndex) => {
      drawText(page, cell, cx + 6, y - rowIndex * rowH + 8, { size: rowIndex === 0 ? 7.4 : 7.8, font: rowIndex === 0 ? bold : regular, color: rowIndex === 0 ? white : ink })
      cx += widths[cellIndex]
    })
  })
  return y - rows.length * rowH
}

async function drawPhoto(page, fileName, x, y, w, h) {
  if (!fileName) {
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.9, 0.92, 0.92), borderColor: line, borderWidth: 1 })
    drawText(page, 'Photo pending', x + 18, y + h / 2, { font: bold, size: 12, color: muted })
    return
  }
  try {
    const bytes = await fs.readFile(path.join(photoDir, fileName))
    const image = await pdfDoc.embedPng(bytes)
    const scale = Math.min(w / image.width, h / image.height)
    const iw = image.width * scale
    const ih = image.height * scale
    page.drawImage(image, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih })
    page.drawRectangle({ x, y, width: w, height: h, borderColor: line, borderWidth: 1 })
  } catch {
    page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.9, 0.92, 0.92), borderColor: line, borderWidth: 1 })
    drawText(page, 'Photo unavailable', x + 18, y + h / 2, { font: bold, size: 12, color: muted })
  }
}

let page = addPage()
page.drawRectangle({ x: 0, y: 622, width: 612, height: 170, color: dark })
drawText(page, 'VESTBLOCK', 44, 738, { font: bold, size: 12, color: rgb(0.54, 0.9, 0.88) })
drawText(page, 'QUALIFIED BUYER PACKET', 396, 738, { font: mono, size: 8, color: rgb(0.82, 0.9, 0.9) })
drawWrapped(page, portfolio.name, 44, 704, 452, { font: bold, size: 28, leading: 32, color: white })
drawWrapped(page, 'Buyer review packet generated from VestBlock portfolio workflow data. Seller claims, public snippets, DealMachine facts, photos, rents, expenses, and municipal records must be independently verified before acquisition.', 44, 640, 520, { size: 10, leading: 14, color: rgb(0.86, 0.93, 0.92) })
metric(page, 'Units', String(portfolio.totalUnits), 44, 536)
metric(page, 'Gross Rent', dollars(portfolio.monthlyGrossRent), 176, 536)
metric(page, 'Ask', dollars(portfolio.sellerAskingPrice), 308, 536)
metric(page, 'Ask / Unit', dollars(workflow.summary.pricePerUnitAtAsk), 440, 536)
section(page, 'Portfolio Summary', 482)
drawWrapped(page, `Five duplexes in Milwaukee totaling ${portfolio.totalUnits} units. Seller-provided rents total ${dollars(portfolio.monthlyGrossRent)} per month / ${dollars(portfolio.annualGrossRent)} per year. Seller states newer roofs, windows, furnaces, hot water heaters, updated electric, and updated plumbing across the portfolio.`, 44, 456, 512, { size: 10.5, leading: 15 })
section(page, 'Buyer Range Snapshot', 350)
table(page, [['Price', 'Price / Unit', 'GRM', 'Cons. Cap', 'Mod. Cap', 'Agg. Cap'], ...['$550,000', '$530,000', '$525,000'].map((price) => { const row = workflow.priceSensitivity[price]; return [price, dollars(row.pricePerUnit), `${row.grossRentMultiplier}x`, pct(row.capRates.conservative.capRatePct), pct(row.capRates.moderate.capRatePct), pct(row.capRates.aggressive.capRatePct)] })], 44, 306, [88, 92, 70, 88, 88, 98])
drawWrapped(page, 'Release note: this buyer packet intentionally excludes seller contact data, tenant contact data, and personal phone/email information. Use diligence and non-circumvention controls before releasing seller access.', 44, 168, 512, { size: 9.5, leading: 14, color: muted })

page = addPage()
drawText(page, 'Financial Analysis', 44, 744, { font: bold, size: 22, color: dark })
drawWrapped(page, 'Actual expenses were not provided. Conservative, moderate, and aggressive expense cases are model assumptions.', 44, 722, 508, { size: 10, color: muted })
section(page, 'NOI and Expense Cases', 678)
table(page, [['Scenario', 'Vacancy', 'Expense Ratio', 'NOI', 'Cap @ Ask', 'Cap @ 530k', 'Cap @ 525k'], ...['conservative', 'moderate', 'aggressive'].map((key) => { const s = workflow.scenarioAnalysis[key]; return [key[0].toUpperCase() + key.slice(1), pct(s.vacancyPct), pct(s.expenseRatioPct), dollars(s.noi), pct(s.capRateAtAskPct), pct(workflow.priceSensitivity['$530,000'].capRates[key].capRatePct), pct(workflow.priceSensitivity['$525,000'].capRates[key].capRatePct)] })], 44, 634, [82, 68, 86, 78, 76, 82, 82])
section(page, 'DSCR Sensitivity - 75% LTV / 7.0% / 30 Years', 500)
table(page, [['Price', 'Loan', 'Annual Debt', 'Cons. DSCR / CF', 'Mod. DSCR / CF', 'Agg. DSCR / CF'], ...['$550,000', '$530,000', '$525,000'].map((price) => { const d = workflow.priceSensitivity[price].dscr.A; return [price, dollars(d.loanAmount), dollars(d.annualDebtService), `${d.byExpenseScenario.conservative.dscr} / ${dollars(d.byExpenseScenario.conservative.cashFlowAfterDebt)}`, `${d.byExpenseScenario.moderate.dscr} / ${dollars(d.byExpenseScenario.moderate.cashFlowAfterDebt)}`, `${d.byExpenseScenario.aggressive.dscr} / ${dollars(d.byExpenseScenario.aggressive.cashFlowAfterDebt)}`] })], 44, 456, [70, 78, 86, 116, 116, 116])
section(page, 'Vacancy Sensitivity', 322)
table(page, [['Vacancy', 'Effective Gross Income'], ...Object.entries(workflow.vacancySensitivity).map(([label, row]) => [label, dollars(row.effectiveGrossIncome)])], 44, 278, [120, 180])
drawWrapped(page, 'The $525k-$530k negotiation range improves DSCR and annual cash flow, but the deal remains dependent on verified leases, deposits, utility responsibility, insurance, taxes, repairs, and city records.', 44, 138, 512, { size: 10.5, leading: 15 })

const cards = workflow.propertyScorecards.map((card) => ({ ...card, facts: dealMachineFacts[card.id] || {} })).sort((a, b) => a.address.localeCompare(b.address))
for (const [index, card] of cards.entries()) {
  page = addPage()
  drawText(page, `Property ${index + 1} of ${cards.length}`, 44, 744, { font: bold, size: 20, color: dark })
  drawWrapped(page, `${card.address}, ${portfolio.city}, ${portfolio.state}`, 44, 720, 512, { font: bold, size: 14, leading: 18, color: teal })
  await drawPhoto(page, card.facts.photo, 44, 488, 250, 180)
  metric(page, 'Rent', `${dollars(card.monthlyRent)}/mo`, 318, 610, 112)
  metric(page, 'Rent / Unit', dollars(card.rentPerUnit), 444, 610, 112)
  metric(page, 'Rent Range', rentRange(card.monthlyRent), 318, 536, 112)
  metric(page, 'Income Share', pct(card.incomeContributionPct), 444, 536, 112)
  section(page, 'DealMachine and Public Data', 456)
  table(page, [['Field', 'Value'], ['Public value', dollars(card.facts.publicValue)], ['Equity indicator', card.facts.equityIndicator || 'TBD'], ['Beds / baths', card.facts.bedsBaths || card.bedBathSummary || 'TBD'], ['Square feet', number(card.facts.squareFeet || card.squareFeet)], ['Year built', card.facts.yearBuilt || 'TBD'], ['Annual tax', card.facts.annualTax ? dollars(card.facts.annualTax) : 'TBD'], ['Repair estimate', dollars(card.facts.repairEstimate)]], 44, 412, [140, 360], { rowH: 22 })
  drawWrapped(page, card.facts.note || 'Verify rent, occupancy, condition, taxes, and municipal records before buyer release.', 44, 190, 512, { size: 9.5, leading: 14, color: muted })
}

page = addPage()
drawText(page, 'Risk, Diligence, and Buyer Fit', 44, 744, { font: bold, size: 22, color: dark })
section(page, 'Missing Data Before Acquisition', 696)
let y = 670
for (const item of portfolio.missingData.slice(0, 10)) {
  drawText(page, '-', 50, y, { size: 9, color: teal })
  y = drawWrapped(page, item, 64, y, 492, { size: 9, leading: 12 }) - 1
}
section(page, 'Buyer Profiles', 486)
table(page, [['Buyer Type', 'Why It May Fit'], ['DSCR investor', 'Existing gross rent and 10-unit scale may support lender analysis if NOI verifies.'], ['Small multifamily investor', 'Five duplexes can work as a starter portfolio or neighborhood density play.'], ['Portfolio buyer', 'Multiple assets create operational leverage if condition and occupancy are clean.'], ['1031 buyer', 'May value speed and replacement-property identification more than a single-asset buyer.'], ['Cash-flow buyer', 'Needs verified rent roll, utility split, and post-rehab maintenance assumptions.']], 44, 442, [146, 378], { rowH: 28 })
section(page, 'Release Checklist', 236)
drawWrapped(page, 'Before sending this outside the first buyer circle: qualify buyer, collect proof of funds or lender letter, confirm non-circumvention expectations, then release leases, interior photos, municipal records, seller disclosures, inspection access, and final seller-approved details.', 44, 210, 512, { size: 10.5, leading: 15 })
page.drawRectangle({ x: 44, y: 62, width: 524, height: 78, color: pale, borderColor: rgb(0.65, 0.83, 0.8), borderWidth: 1 })
drawWrapped(page, 'Important: VestBlock presents calculations, assumptions, risks, and available public/seller-provided data only. This is not investment advice and should not be treated as final diligence.', 60, 114, 492, { font: bold, size: 10, leading: 14, color: navy })

const pdfBytes = await pdfDoc.save()
await fs.mkdir(path.dirname(outPath), { recursive: true })
await fs.writeFile(outPath, pdfBytes)
console.log(outPath)
