import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule

const { processDocumentDirectly } = require('../lib/server-document-processor') as typeof import('../lib/server-document-processor')

async function main() {
  const packagePath = require.resolve('pdf-parse/package.json')
  const fixturePath = path.join(path.dirname(packagePath), 'test/data/01-valid.pdf')
  const bytes = fs.readFileSync(fixturePath)
  const file = new File([bytes], 'pdf-parse-valid-fixture.pdf', { type: 'application/pdf' })

  const result = await processDocumentDirectly(file, 'test-user')
  assert.equal(result.metadata.extractionMethod, 'pdf-parse')
  assert.equal(result.metadata.pageCount, 14)
  assert.match(result.text, /Trace-based Just-in-Time Type Specialization/)
  assert.equal(result.metadata.error, undefined)

  console.log('server-document-processor: ok')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
