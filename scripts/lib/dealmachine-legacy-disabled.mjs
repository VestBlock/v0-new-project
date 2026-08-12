export function blockLegacyDealMachineApi(scriptName) {
  throw new Error(
    `${scriptName} is disabled because it targets DealMachine's legacy/private API. ` +
      'Use scripts/dealmachine-v2-strategy-run.mjs with the official v2 API.'
  )
}
