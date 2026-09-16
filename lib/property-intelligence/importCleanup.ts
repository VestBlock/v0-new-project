type DeleteResult = { error?: unknown }

type CleanupClient = {
  from: (table: string) => {
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<DeleteResult>
    }
  }
}

function cleanupErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'unknown cleanup failure')
}

/**
 * Removes the property aggregate created by a failed row import. Child rows
 * cascade from the property; the owner is removed only after that succeeds so
 * a retry cannot mistake a partial aggregate for a completed duplicate.
 */
export async function cleanupPartialPropertyImport(
  admin: CleanupClient,
  input: { propertyId?: string | null; ownerId?: string | null }
) {
  if (input.propertyId) {
    const { error } = await admin
      .from('property_intelligence_records')
      .delete()
      .eq('id', input.propertyId)
    if (error) {
      throw new Error(`Failed to remove partial property ${input.propertyId}: ${cleanupErrorMessage(error)}`)
    }
  }

  if (input.ownerId) {
    const { error } = await admin
      .from('owner_entities')
      .delete()
      .eq('id', input.ownerId)
    if (error) {
      throw new Error(`Failed to remove partial owner ${input.ownerId}: ${cleanupErrorMessage(error)}`)
    }
  }
}
