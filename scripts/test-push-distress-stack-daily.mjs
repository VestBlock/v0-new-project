#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import Module, { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import {
  loadDailyCandidates,
  parseCsv,
  selectDailyCandidates,
  toCsv,
} from './push-distress-stack-daily.mjs'

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' })
const require = createRequire(import.meta.url)
require('ts-node/register')
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveVestBlockAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(this, request.replace('@/', `${process.cwd()}/`), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}
const { parsePropertyImport } = require('../lib/property-intelligence/import.ts')

const parsed = parseCsv('address,violation\n"10 Main St","Open code, exterior\nunsafe stair"\n')
assert.equal(parsed.length, 1)
assert.equal(parsed[0].violation, 'Open code, exterior\nunsafe stair')

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vestblock-stack-test-'))
try {
  fs.writeFileSync(path.join(directory, 'detroit-2026-09-16-BOTH-SIGNALS.csv'), [
    'address,city,violation,stack_match,tax_delinquent_hit,delinquent_amount,delinquent_owner',
    '"1 Oak Street","Detroit","Unpaid blight","YES","","$5000","Owner (mails from elsewhere)"',
    '"1 Oak St","Detroit","Duplicate lower score","YES","","$10","Owner"',
    '"2 Pine Ave","Detroit","Unpaid blight","YES","","$4000","Owner"',
    '"3 Elm Road","Detroit","Unpaid blight","YES","","$3000","Owner"',
  ].join('\n'))
  fs.writeFileSync(path.join(directory, 'milwaukee-2026-09-16-BOTH-SIGNALS.csv'), [
    'address,city,violation,tax_delinquent_hit,delinquent_amount,delinquent_owner',
    '"4 Lake St","Milwaukee","Vacant building","YES","$2000","Owner"',
    '"5 River St","Milwaukee","Vacant building","YES","$1000","Owner"',
  ].join('\n'))

  const candidates = loadDailyCandidates({ directory, date: '2026-09-16' })
  const selected = selectDailyCandidates(candidates, 4)
  assert.equal(new Set(candidates.map((row) => row._key)).size, 5)
  assert.equal(selected.length, 4)
  assert.equal(selected.filter((row) => row._market === 'detroit').length, 2)
  assert.ok(selected.every((row) => row.state && row.county && row.signal_count === 2))
  const selectedCsv = toCsv(selected)
  assert.match(selectedCsv, /property_address,city,state,county/)
  const preview = parsePropertyImport(selectedCsv, {
    sourceName: 'public_distress_stack:multi-signal',
    fileName: 'stack.csv',
    fileType: 'text/csv',
    confidenceLevel: 92,
  })
  assert.equal(preview.length, selected.length)
  for (const row of preview) {
    assert.equal(row.signals.length, 2, `${row.input.propertyAddress} must retain both source signals`)
    assert.equal(row.dealScore.score >= 40, true, `${row.input.propertyAddress} must not enter the zero-signal watchlist`)
  }
  const detroit = preview.find((row) => row.input.state === 'MI')
  assert.equal(detroit.input.rawFields.tax_delinquent_hit, '', 'Detroit raw evidence must not claim tax delinquency')
  assert.deepEqual(
    detroit.signals.map((signal) => signal.signal_type).sort(),
    ['absentee_owner', 'code_violation'],
    'Detroit must remain blight plus absentee and must not be mislabeled tax delinquent',
  )
} finally {
  fs.rmSync(directory, { recursive: true, force: true })
}

console.log('distress Stack daily selection tests passed')
