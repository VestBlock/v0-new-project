export function sellerQueueCandidateReadinessTier(input: {
  compliantCopy: boolean
  provenanceAutoApproval: boolean
  explicitAdminApproval: boolean
  messageStatus: string
}) {
  if (!['approved', 'needs_review'].includes(input.messageStatus)) return 0

  const deliveryAuthorized = sellerQueueCandidateDeliveryAuthorized(input)

  if (deliveryAuthorized && input.compliantCopy) return 3
  if (deliveryAuthorized) return 2
  if (input.compliantCopy) return 1
  return 0
}

/**
 * Seller drafts only belong in an autonomous delivery workset when their
 * strategy provenance permits auto-approval or an admin explicitly approved
 * that exact message. Review-only seller inventory remains untouched for the
 * human workflow, but cannot occupy an autonomous B2B candidate slot.
 */
export function sellerQueueCandidateDeliveryAuthorized(input: {
  provenanceAutoApproval: boolean
  explicitAdminApproval: boolean
  messageStatus: string
}) {
  if (!['approved', 'needs_review'].includes(input.messageStatus)) return false
  return input.provenanceAutoApproval || input.explicitAdminApproval
}

export function prioritizeOutreachQueueCandidates<T>(
  rows: readonly T[],
  readinessTier: (row: T) => number,
  limit: number
) {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 0

  return rows
    .map((row, originalIndex) => ({
      row,
      originalIndex,
      readinessTier: readinessTier(row),
    }))
    .sort(
      (left, right) =>
        right.readinessTier - left.readinessTier ||
        left.originalIndex - right.originalIndex
    )
    .slice(0, normalizedLimit)
    .map((candidate) => candidate.row)
}

export function prioritizeAndDedupeOutreachQueueCandidates<T>(
  rows: readonly T[],
  readinessTier: (row: T) => number,
  keys: {
    recipient: (row: T) => string | null
    sellerProperty: (row: T) => string | null
  }
) {
  const seenRecipients = new Set<string>()
  const seenSellerProperties = new Set<string>()

  return prioritizeOutreachQueueCandidates(rows, readinessTier, rows.length).filter((row) => {
    const recipient = keys.recipient(row)
    if (recipient && seenRecipients.has(recipient)) return false
    const property = keys.sellerProperty(row)
    if (property && seenSellerProperties.has(property)) return false
    if (recipient) seenRecipients.add(recipient)
    if (property) seenSellerProperties.add(property)
    return true
  })
}
