import assert from 'node:assert/strict'

import { cleanupPartialPropertyImport } from '../lib/property-intelligence/importCleanup'

function cleanupClient(failTable = '') {
  const calls: Array<{ table: string; column: string; value: string }> = []
  return {
    calls,
    client: {
      from(table: string) {
        return {
          delete() {
            return {
              async eq(column: string, value: string) {
                calls.push({ table, column, value })
                return { error: table === failTable ? new Error(`${table} unavailable`) : null }
              },
            }
          },
        }
      },
    },
  }
}

async function main() {
  const successful = cleanupClient()
  await cleanupPartialPropertyImport(successful.client, { propertyId: 'property-1', ownerId: 'owner-1' })
  assert.deepEqual(successful.calls, [
    { table: 'property_intelligence_records', column: 'id', value: 'property-1' },
    { table: 'owner_entities', column: 'id', value: 'owner-1' },
  ])

  const failedProperty = cleanupClient('property_intelligence_records')
  await assert.rejects(
    cleanupPartialPropertyImport(failedProperty.client, { propertyId: 'property-2', ownerId: 'owner-2' }),
    /Failed to remove partial property property-2/
  )
  assert.deepEqual(
    failedProperty.calls,
    [{ table: 'property_intelligence_records', column: 'id', value: 'property-2' }],
    'the owner must remain attached when property cleanup fails'
  )

  console.log('Property import cleanup tests passed.')
}

void main()
