import fs from 'node:fs'
import path from 'node:path'

import { ingestDealMachineContactsCsv } from '@/lib/dealmachine/contactExport'

function arg(name: string) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || ''
}

async function main() {
  const csvPath = path.resolve(arg('csv'))
  const manifestPath = path.resolve(arg('manifest'))
  if (!fs.existsSync(csvPath)) throw new Error(`CSV does not exist: ${csvPath}`)
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest does not exist: ${manifestPath}`)

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const result = await ingestDealMachineContactsCsv({
    csvContent: fs.readFileSync(csvPath, 'utf8'),
    strategyKey: manifest.strategyKey,
    matchedStrategyKeys: manifest.candidateOnly ? [] : [manifest.strategyKey],
    strategySignals: manifest.signals,
    candidateOnly: Boolean(manifest.candidateOnly),
    candidateReason: manifest.candidateReason || null,
    reviewOnly: Boolean(manifest.reviewOnly),
    strategyVariant: manifest.variant,
    sourceObservedAt: manifest.sourceObservedAt,
    sourceFilters: manifest.filters,
    market: manifest.market,
    listId: manifest.listId || null,
    exportId: manifest.exportId || null,
    dryRun: process.argv.includes('--dry-run'),
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
