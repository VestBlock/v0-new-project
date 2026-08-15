import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cases = [
  {
    file: 'lib/buyers/automation.ts',
    providerCall: 'await sendBuyerOutreachEmail(',
    authorizationCall: 'await requireAuthorization()',
    sourceBinding: 'strategyKey: binding.sourceIdentifier',
    sourceIdentifier: "'buyer-network'",
    subjectNamespace: "subjectNamespace: 'buyer'",
    subjectKey: 'subjectKey: buyer.id',
    consentCall: 'await buyerConsentSnapshot(',
    suppressionCall: 'await buyerSuppressionSnapshot(',
    providerArgument: 'provider: adapter.provider',
    dispatchChannel: 'dispatchChannel: adapter.channel',
  },
  {
    file: 'lib/buyers/packetDelivery.ts',
    providerCall: 'await sendBuyerPacketEmail(',
    authorizationCall: 'await authorizeBuyerPacketDispatch(',
    sourceBinding: 'strategyKey: authorization.binding.sourceIdentifier',
    sourceIdentifier: "'buyer-packet-routing'",
    subjectNamespace: "subjectNamespace: 'buyer_packet'",
    subjectKey: 'subjectKey: packet.id',
    consentCall: 'await buyerPacketConsentSnapshot(',
    suppressionCall: 'await packetSuppressionSnapshot(',
    providerArgument: 'provider: authorization.adapter.provider',
    dispatchChannel: 'dispatchChannel: authorization.adapter.channel',
  },
  {
    file: 'lib/lenders/automation.ts',
    providerCall: 'await sendLenderOutreachEmail(',
    authorizationCall: 'await requireAuthorization()',
    sourceBinding: 'strategyKey: binding.sourceIdentifier',
    sourceIdentifier: "'lender-network'",
    subjectNamespace: "subjectNamespace: 'lender'",
    subjectKey: 'subjectKey: lender.id',
    consentCall: 'await lenderConsentSnapshot(',
    suppressionCall: 'await lenderSuppressionSnapshot(',
    providerArgument: 'provider: adapter.provider',
    dispatchChannel: 'dispatchChannel: adapter.channel',
  },
  {
    file: 'lib/investors/service.ts',
    providerCall: 'await sendInvestorOutreachEmail(',
    authorizationCall: 'await requireAuthorization()',
    sourceBinding: 'strategyKey: binding.sourceIdentifier',
    sourceIdentifier: "'investor-network'",
    subjectNamespace: "subjectNamespace: 'investor_profile'",
    subjectKey: 'subjectKey: investor.id',
    consentCall: 'await investorConsentSnapshot(',
    suppressionCall: 'await investorSuppressionSnapshot(',
    providerArgument: 'provider: adapter.provider',
    dispatchChannel: 'dispatchChannel: adapter.channel',
  },
  {
    file: 'app/api/admin/leads/[id]/outreach/route.ts',
    providerCall: 'await sendLeadOutreachEmail(',
    authorizationCall: 'await authorizeRevenueCampaignDispatch(',
    sourceBinding: 'strategyKey: authorization.binding.sourceIdentifier',
    sourceIdentifier: "namespace: 'revenue_campaign'",
    subjectNamespace: "subjectNamespace: 'lead'",
    subjectKey: 'subjectKey: id',
    consentCall: 'await leadConsentSnapshot(',
    suppressionCall: 'await listSuppressions()',
    providerArgument: 'provider: authorization.adapter.provider',
    dispatchChannel: 'dispatchChannel: authorization.adapter.channel',
  },
  {
    file: 'app/api/admin/buyers/[id]/outreach/route.ts',
    providerCall: 'await sendBuyerOutreachEmail(',
    authorizationCall: 'await authorizeBuyerEmailDispatch()',
    sourceBinding: 'strategyKey: authorization.binding.sourceIdentifier',
    sourceIdentifier: "'buyer-network'",
    subjectNamespace: "subjectNamespace: 'buyer'",
    subjectKey: 'subjectKey: buyer.id',
    consentCall: 'await buyerConsentSnapshot(',
    suppressionCall: 'await buyerSuppressionSnapshot(',
    providerArgument: 'provider: authorization.adapter.provider',
    dispatchChannel: 'dispatchChannel: authorization.adapter.channel',
  },
  {
    file: 'app/api/admin/lenders/[id]/outreach/route.ts',
    providerCall: 'await sendLenderOutreachEmail(',
    authorizationCall: 'await authorizeLenderEmailDispatch()',
    sourceBinding: 'strategyKey: authorization.binding.sourceIdentifier',
    sourceIdentifier: "'lender-network'",
    subjectNamespace: "subjectNamespace: 'lender'",
    subjectKey: 'subjectKey: lender.id',
    consentCall: 'await lenderConsentSnapshot(',
    suppressionCall: 'await lenderSuppressionSnapshot(',
    providerArgument: 'provider: authorization.adapter.provider',
    dispatchChannel: 'dispatchChannel: authorization.adapter.channel',
  },
]

for (const testCase of cases) {
  const source = readFileSync(resolve(process.cwd(), testCase.file), 'utf8')
  const providerIndex = source.indexOf(testCase.providerCall)
  const authorizationIndex = source.lastIndexOf(testCase.authorizationCall, providerIndex)
  const consentIndex = source.lastIndexOf(testCase.consentCall, providerIndex)
  const suppressionIndex = source.lastIndexOf(testCase.suppressionCall, providerIndex)
  const reservationIndex = source.lastIndexOf('await reserveOperatingStrategyDispatch({', providerIndex)
  const enrollmentIndex = source.lastIndexOf('await recordOutboundEnrollment({', providerIndex)

  assert.notEqual(providerIndex, -1, `${testCase.file} must retain its customer provider call`)
  assert.notEqual(authorizationIndex, -1, `${testCase.file} must authorize before provider dispatch`)
  assert.ok(
    authorizationIndex < providerIndex,
    `${testCase.file} must resolve its governed authorization before provider dispatch`
  )
  assert.notEqual(consentIndex, -1, `${testCase.file} must prove consent before provider dispatch`)
  assert.notEqual(suppressionIndex, -1, `${testCase.file} must clear suppression before provider dispatch`)
  assert.ok(consentIndex < providerIndex, `${testCase.file} must prove consent before provider dispatch`)
  assert.ok(suppressionIndex < providerIndex, `${testCase.file} must clear suppression before provider dispatch`)
  assert.notEqual(reservationIndex, -1, `${testCase.file} must reserve governed capacity before dispatch`)
  assert.ok(
    authorizationIndex < reservationIndex && consentIndex < reservationIndex && suppressionIndex < reservationIndex,
    `${testCase.file} must authorize, prove consent, and clear suppression before reserving capacity`
  )
  assert.notEqual(enrollmentIndex, -1, `${testCase.file} must persist an outbound intent before dispatch`)
  assert.ok(
    reservationIndex < enrollmentIndex && enrollmentIndex < providerIndex,
    `${testCase.file} must reserve capacity and then persist the outbound intent before provider dispatch`
  )

  const preDispatchEnrollment = source.slice(reservationIndex, providerIndex)
  assert.match(
    preDispatchEnrollment,
    /status:\s*'queued'/,
    `${testCase.file} must persist the pre-dispatch enrollment as queued`
  )
  assert.ok(
    preDispatchEnrollment.includes("governedStage: 'dispatch_intent' as const"),
    `${testCase.file} must identify the durable row as a governed dispatch intent`
  )
  assert.ok(
    preDispatchEnrollment.includes('dispatchReservationId: reservation.reservationId'),
    `${testCase.file} must bind the durable intent to its atomic reservation`
  )
  assert.ok(
    preDispatchEnrollment.includes(testCase.dispatchChannel),
    `${testCase.file} must persist the exact authorized adapter channel`
  )

  const providerCallBlock = source.slice(providerIndex, providerIndex + 600)
  assert.ok(
    providerCallBlock.includes(testCase.providerArgument),
    `${testCase.file} must call the exact provider selected before the durable intent`
  )
  assert.ok(
    providerCallBlock.includes('disableFallback: true'),
    `${testCase.file} must disable silent provider fallback for governed dispatch`
  )

  assert.ok(source.includes(testCase.sourceBinding), `${testCase.file} must persist the raw source identifier`)
  assert.ok(source.includes(testCase.sourceIdentifier), `${testCase.file} must use its registry-backed source identifier`)
  assert.ok(source.includes(testCase.subjectNamespace), `${testCase.file} must persist its governed subject namespace`)
  assert.ok(source.includes(testCase.subjectKey), `${testCase.file} must persist a stable governed subject key`)
  assert.ok(source.includes('dispatchAuthorized: true'), `${testCase.file} must persist affirmative consent authorization`)
  assert.ok(source.includes('suppressionCleared: true'), `${testCase.file} must persist an affirmative suppression result`)
  assert.ok(source.includes('evidenceKey:'), `${testCase.file} must persist evidence keys for governed preflights`)
  assert.ok(source.includes('provenance:'), `${testCase.file} must persist preflight provenance`)

  const outcomeIndex = source.indexOf('recordStrategyDeliveryOutcome({', providerIndex)
  assert.notEqual(outcomeIndex, -1, `${testCase.file} must append provider-result evidence after dispatch`)
  assert.ok(providerIndex < outcomeIndex, `${testCase.file} must record provider-result evidence after the provider result`)
  const outcomeBlock = source.slice(outcomeIndex, outcomeIndex + 1400)
  assert.match(
    outcomeBlock,
    /if\s*\(!\w*[Dd]eliveryOutcome\.updated\)/,
    `${testCase.file} must fail closed when provider-result attribution is not durable`
  )

  let nextOutcomeIndex = outcomeIndex
  while (nextOutcomeIndex !== -1) {
    const remainingSource = source.slice(nextOutcomeIndex)
    const outcomeCall = remainingSource.match(/^recordStrategyDeliveryOutcome\(\{[\s\S]*?\n\s*\}\)/)
    assert.ok(outcomeCall, `${testCase.file} must retain a structurally complete provider-result evidence call`)
    const occurredAtMatch = outcomeCall[0].match(/occurredAt:\s*(\w+)/)
    assert.ok(occurredAtMatch, `${testCase.file} must pass a stable occurredAt to every provider-result evidence call`)
    const timestampName = occurredAtMatch[1]
    const timestampDeclaration = source.lastIndexOf(
      `const ${timestampName} = new Date().toISOString()`,
      nextOutcomeIndex
    )
    const resultEnrollmentIndex = source.lastIndexOf('await recordOutboundEnrollment({', nextOutcomeIndex)
    assert.ok(
      timestampDeclaration > providerIndex &&
        timestampDeclaration < resultEnrollmentIndex &&
        resultEnrollmentIndex < nextOutcomeIndex,
      `${testCase.file} must capture provider-result time once before the enrollment and evidence updates`
    )
    nextOutcomeIndex = source.indexOf(
      'recordStrategyDeliveryOutcome({',
      nextOutcomeIndex + outcomeCall[0].length
    )
  }

  const lines = source.split('\n')
  const swallowedGovernance = lines.some((line, index) => {
    if (!line.includes('.catch(() => null)')) return false
    for (let previous = index; previous >= 0; previous -= 1) {
      if (!lines[previous].includes('await ')) continue
      return (
        lines[previous].includes('recordOutboundEnrollment') ||
        lines[previous].includes('reserveOperatingStrategyDispatch') ||
        lines[previous].includes('recordStrategyDeliveryOutcome')
      )
    }
    return false
  })
  assert.equal(swallowedGovernance, false, `${testCase.file} must not swallow governed reservation, intent, or outcome failures`)
}

console.log(`Gate 3C secondary outbound guard checks passed for ${cases.length} paths.`)
