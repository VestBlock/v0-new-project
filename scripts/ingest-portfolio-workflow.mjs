#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEFAULT_SOURCE = path.join(ROOT, 'data', 'property-portfolios', 'milwaukee-10-unit-duplex-portfolio.json')
const COMMAND_CENTER_DIR = path.join(ROOT, 'data', 'command-center')

function parseArgs(argv) {
  const args = {
    source: DEFAULT_SOURCE,
    verifyOnly: false,
  }

  for (const arg of argv) {
    if (arg.startsWith('--source=')) args.source = path.resolve(ROOT, arg.slice('--source='.length))
    if (arg === '--verify') args.verifyOnly = true
  }

  return args
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function round(value, digits = 0) {
  const factor = 10 ** digits
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

function pct(value) {
  return round(Number(value) * 100, 2)
}

function money(value) {
  return round(value, 0)
}

function stableId(prefix, seed) {
  const normalized = String(seed).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const suffix = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 8)
  return `${prefix}_${normalized}_${suffix}`
}

function monthlyPayment(principal, annualRate, years) {
  const months = years * 12
  const monthlyRate = annualRate / 12
  if (!principal || !months) return 0
  if (!monthlyRate) return principal / months
  return principal * ((monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1))
}

function scenarioExpenseLines(gsi, assumptions) {
  const vacancy = gsi * assumptions.vacancyPct
  const egi = gsi - vacancy
  const repairs = gsi * assumptions.repairsPctOfGsi
  const capex = gsi * assumptions.capexPctOfGsi
  const management = egi * assumptions.managementPctOfEgi
  const misc = gsi * assumptions.miscPctOfGsi
  const taxes = assumptions.propertyTaxesAnnual
  const insurance = assumptions.insuranceAnnual
  const totalExpenses = vacancy + taxes + insurance + repairs + capex + management + misc
  const noi = gsi - totalExpenses

  return {
    vacancy: money(vacancy),
    effectiveGrossIncome: money(egi),
    propertyTaxes: money(taxes),
    insurance: money(insurance),
    repairsAndMaintenance: money(repairs),
    capitalExpenditures: money(capex),
    propertyManagement: money(management),
    miscellaneousReserves: money(misc),
    totalExpenses: money(totalExpenses),
    noi: money(noi),
    expenseRatioPct: pct(totalExpenses / gsi),
  }
}

function computePortfolio(portfolio) {
  const gsi = portfolio.annualGrossRent
  const purchasePrices = [portfolio.sellerAskingPrice, ...(portfolio.negotiationPrices || [])]
  const vacancySensitivity = Object.fromEntries(
    portfolio.vacancySensitivity.map((rate) => [
      `${pct(rate)}%`,
      {
        vacancyPct: pct(rate),
        effectiveGrossIncome: money(gsi * (1 - rate)),
      },
    ])
  )

  const propertyScorecards = portfolio.properties.map((property) => {
    const incomePct = property.monthlyRent / portfolio.monthlyGrossRent
    return {
      id: property.id,
      address: property.address,
      monthlyRent: property.monthlyRent,
      annualRent: property.monthlyRent * 12,
      units: property.units,
      incomeContributionPct: pct(incomePct),
      allocatedValueAtAsk: money(portfolio.sellerAskingPrice * incomePct),
      rentPerUnit: money(property.monthlyRent / property.units),
      rentPerSquareFoot: property.squareFeet ? round(property.monthlyRent / property.squareFeet, 2) : null,
      squareFeet: property.squareFeet,
      bedBathSummary: property.bedBathSummary,
      dataConfidence: property.dataConfidence,
      sourceUrls: property.sourceUrls || [],
    }
  })

  const scenarioAnalysis = Object.fromEntries(
    Object.entries(portfolio.expenseAssumptions).map(([key, assumptions]) => {
      const lines = scenarioExpenseLines(gsi, assumptions)
      return [
        key,
        {
          vacancyPct: pct(assumptions.vacancyPct),
          assumptions,
          ...lines,
          capRateAtAskPct: pct(lines.noi / portfolio.sellerAskingPrice),
        },
      ]
    })
  )

  const priceSensitivity = Object.fromEntries(
    purchasePrices.map((price) => {
      const scenarioCaps = Object.fromEntries(
        Object.entries(scenarioAnalysis).map(([key, scenario]) => [
          key,
          {
            noi: scenario.noi,
            capRatePct: pct(scenario.noi / price),
          },
        ])
      )

      const dscr = Object.fromEntries(
        portfolio.financingScenarios.map((financing) => {
          const loanAmount = price * financing.ltv
          const annualDebtService = monthlyPayment(loanAmount, financing.interestRate, financing.termYears) * 12
          return [
            financing.key,
            {
              label: financing.label,
              loanAmount: money(loanAmount),
              annualDebtService: money(annualDebtService),
              byExpenseScenario: Object.fromEntries(
                Object.entries(scenarioAnalysis).map(([scenarioKey, scenario]) => [
                  scenarioKey,
                  {
                    noi: scenario.noi,
                    dscr: round(scenario.noi / annualDebtService, 2),
                    cashFlowAfterDebt: money(scenario.noi - annualDebtService),
                  },
                ])
              ),
            },
          ]
        })
      )

      return [
        `$${price.toLocaleString('en-US')}`,
        {
          purchasePrice: price,
          pricePerUnit: money(price / portfolio.totalUnits),
          grossRentMultiplier: round(price / gsi, 2),
          capRates: scenarioCaps,
          dscr,
        },
      ]
    })
  )

  return {
    generatedAt: new Date().toISOString(),
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    summary: {
      totalUnits: portfolio.totalUnits,
      monthlyGrossRent: portfolio.monthlyGrossRent,
      annualGrossRent: portfolio.annualGrossRent,
      sellerAskingPrice: portfolio.sellerAskingPrice,
      pricePerUnitAtAsk: money(portfolio.sellerAskingPrice / portfolio.totalUnits),
      grossRentMultiplierAtAsk: round(portfolio.sellerAskingPrice / gsi, 2),
    },
    vacancySensitivity,
    propertyScorecards,
    scenarioAnalysis,
    priceSensitivity,
    missingData: portfolio.missingData,
    dueDiligenceChecklist: portfolio.dueDiligenceChecklist,
    buyerProfiles: portfolio.buyerProfiles,
    buyerPacketPath: portfolio.buyerPacketPath,
    sourceData: {
      sellerStatedImprovements: portfolio.sellerStatedImprovements,
      workflowNotes: portfolio.workflowNotes,
    },
  }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function writeUniqueJsonl(file, record, uniqueKey = 'id') {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const rows = readJsonl(file).filter((row) => String(row[uniqueKey]) !== String(record[uniqueKey]))
  rows.push(record)
  fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8')
}

function makeWorkflowRecords(portfolio, analysis, paths) {
  const now = analysis.generatedAt
  const analysisId = stableId('analysis', portfolio.id)
  const packetId = stableId('buyer_packet', portfolio.id)
  const pipelineId = stableId('pipeline', portfolio.id)
  const eventId = stableId('event', `${portfolio.id}|portfolio_workflow_created`)
  const moderateNoi = analysis.scenarioAnalysis.moderate?.noi ?? null
  const conservativeNoi = analysis.scenarioAnalysis.conservative?.noi ?? null
  const askingMetrics = analysis.priceSensitivity[`$${portfolio.sellerAskingPrice.toLocaleString('en-US')}`]

  const nextAction =
    'Verify rent roll, leases, expenses, city records, and photos before sending the buyer packet to DSCR or small multifamily buyers.'

  const propertyAnalysis = {
    id: analysisId,
    propertyAddress: `${portfolio.city} 10-Unit Duplex Portfolio (5 duplexes)`,
    city: portfolio.city,
    state: portfolio.state,
    zipCode: null,
    analysisSource: 'portfolio_workflow',
    estimateValue: portfolio.sellerAskingPrice,
    arv: null,
    repairBudget: null,
    assignmentFee: null,
    mao: null,
    sellerAsk: portfolio.sellerAskingPrice,
    spread: null,
    endBuyerProfit: null,
    grade: null,
    dealStrengthScore: 62,
    dealStrengthLabel: 'Needs verification',
    primaryRouteKey: 'small_multifamily_portfolio',
    primaryRouteLabel: 'Small Multifamily Portfolio',
    primaryRouteScore: 78,
    buyerInterestLabel: 'Portfolio Buyer Review',
    buyerInterestScore: 72,
    builderLabel: null,
    nextAction,
    createdAt: now,
    metadata: {
      portfolioId: portfolio.id,
      assetType: portfolio.assetType,
      totalUnits: portfolio.totalUnits,
      monthlyGrossRent: portfolio.monthlyGrossRent,
      annualGrossRent: portfolio.annualGrossRent,
      pricePerUnitAtAsk: analysis.summary.pricePerUnitAtAsk,
      grossRentMultiplierAtAsk: analysis.summary.grossRentMultiplierAtAsk,
      conservativeNoi,
      moderateNoi,
      capRateModerateAtAskPct: analysis.scenarioAnalysis.moderate?.capRateAtAskPct ?? null,
      askingDscrScenarioAConservative:
        askingMetrics?.dscr?.A?.byExpenseScenario?.conservative?.dscr ?? null,
      askingDscrScenarioAModerate: askingMetrics?.dscr?.A?.byExpenseScenario?.moderate?.dscr ?? null,
      negotiationPrices: portfolio.negotiationPrices,
      buyerPacketPath: paths.buyerPacketPath,
      sourceDataPath: paths.sourceDataPath,
      workflowRunPath: paths.workflowRunPath,
      propertyCount: portfolio.properties.length,
      missingDataCount: portfolio.missingData.length,
      diligenceChecklistCount: portfolio.dueDiligenceChecklist.length,
      noContactDataInPacket: true,
      propertyScorecards: analysis.propertyScorecards,
      vacancySensitivity: analysis.vacancySensitivity,
      scenarioAnalysis: analysis.scenarioAnalysis,
      priceSensitivity: analysis.priceSensitivity,
      buyerProfiles: portfolio.buyerProfiles,
      missingData: portfolio.missingData,
      dueDiligenceChecklist: portfolio.dueDiligenceChecklist,
    },
  }

  const event = {
    id: eventId,
    eventType: 'portfolio_workflow_created',
    entityType: 'portfolio',
    entityId: portfolio.id,
    source: 'portfolio_workflow',
    title: `Portfolio workflow added: ${portfolio.name}`,
    summary: `${portfolio.totalUnits} units, $${portfolio.monthlyGrossRent.toLocaleString('en-US')} monthly rent, $${portfolio.sellerAskingPrice.toLocaleString('en-US')} ask. Buyer packet linked; diligence gaps flagged.`,
    priority: 'warning',
    status: 'open',
    occurredAt: now,
    metadata: {
      portfolioId: portfolio.id,
      analysisId,
      packetId,
      pipelineId,
      buyerPacketPath: paths.buyerPacketPath,
      workflowRunPath: paths.workflowRunPath,
      nextAction,
    },
  }

  const buyerPacket = {
    id: packetId,
    propertyAnalysisRunId: analysisId,
    propertyAddress: propertyAnalysis.propertyAddress,
    city: portfolio.city,
    state: portfolio.state,
    zipCode: null,
    status: fs.existsSync(path.join(ROOT, portfolio.buyerPacketPath)) ? 'ready_for_review' : 'needs_pdf',
    selectedBuyerCount: 0,
    sentCount: 0,
    openedCount: 0,
    repliedCount: 0,
    lastSentAt: null,
    createdAt: now,
    updatedAt: now,
    metadata: {
      portfolioId: portfolio.id,
      buyerPacketPath: paths.buyerPacketPath,
      noContactDataInPacket: true,
      buyerProfiles: portfolio.buyerProfiles,
      missingData: portfolio.missingData,
    },
  }

  const pipelineItem = {
    id: pipelineId,
    propertyAnalysisRunId: analysisId,
    buyerPacketId: packetId,
    leadId: null,
    propertyAddress: propertyAnalysis.propertyAddress,
    city: portfolio.city,
    state: portfolio.state,
    zipCode: null,
    currentStage: 'diligence_required',
    stageLabel: 'Diligence Required',
    priority: 'high',
    dealGrade: null,
    dealStrengthScore: propertyAnalysis.dealStrengthScore,
    buyerPacketSentCount: 0,
    buyerReplyCount: 0,
    estimatedAssignmentFee: null,
    expectedProfit: null,
    nextAction,
    nextActionAt: null,
    createdAt: now,
    updatedAt: now,
    metadata: {
      portfolioId: portfolio.id,
      portfolioWorkflow: true,
      buyerProfiles: portfolio.buyerProfiles,
      sourceDataPath: paths.sourceDataPath,
      workflowRunPath: paths.workflowRunPath,
    },
  }

  return { propertyAnalysis, event, buyerPacket, pipelineItem }
}

function verifyRecord(file, id) {
  return readJsonl(file).some((row) => String(row.id) === String(id))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const portfolio = readJson(args.source)
  const analysis = computePortfolio(portfolio)
  const workflowRunPath = path.join(ROOT, 'data', 'property-portfolios', `${portfolio.slug}.workflow.json`)
  const paths = {
    sourceDataPath: path.relative(ROOT, args.source),
    workflowRunPath: path.relative(ROOT, workflowRunPath),
    buyerPacketPath: portfolio.buyerPacketPath,
  }
  const records = makeWorkflowRecords(portfolio, analysis, paths)

  if (!args.verifyOnly) {
    fs.mkdirSync(path.dirname(workflowRunPath), { recursive: true })
    fs.writeFileSync(workflowRunPath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8')
    writeUniqueJsonl(path.join(COMMAND_CENTER_DIR, 'property-analysis-runs.jsonl'), records.propertyAnalysis)
    writeUniqueJsonl(path.join(COMMAND_CENTER_DIR, 'command-center-events.jsonl'), records.event)
    writeUniqueJsonl(path.join(COMMAND_CENTER_DIR, 'property-buyer-packets.jsonl'), records.buyerPacket)
    writeUniqueJsonl(path.join(COMMAND_CENTER_DIR, 'deal-pipeline-items.jsonl'), records.pipelineItem)
  }

  const verification = {
    workflowRunWritten: fs.existsSync(workflowRunPath),
    propertyAnalysisIndexed: verifyRecord(
      path.join(COMMAND_CENTER_DIR, 'property-analysis-runs.jsonl'),
      records.propertyAnalysis.id
    ),
    commandCenterEventIndexed: verifyRecord(path.join(COMMAND_CENTER_DIR, 'command-center-events.jsonl'), records.event.id),
    buyerPacketIndexed: verifyRecord(path.join(COMMAND_CENTER_DIR, 'property-buyer-packets.jsonl'), records.buyerPacket.id),
    pipelineItemIndexed: verifyRecord(path.join(COMMAND_CENTER_DIR, 'deal-pipeline-items.jsonl'), records.pipelineItem.id),
  }

  console.log(
    JSON.stringify(
      {
        portfolio: portfolio.name,
        source: paths.sourceDataPath,
        workflowRun: paths.workflowRunPath,
        buyerPacket: paths.buyerPacketPath,
        summary: analysis.summary,
        moderateNoi: analysis.scenarioAnalysis.moderate.noi,
        conservativeNoi: analysis.scenarioAnalysis.conservative.noi,
        verification,
      },
      null,
      2
    )
  )

  if (Object.values(verification).some((value) => !value)) {
    process.exitCode = 1
  }
}

main()
