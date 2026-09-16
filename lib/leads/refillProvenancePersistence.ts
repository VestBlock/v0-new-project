import {
  buildCurrentEmailReadyRefillProvenance,
  CURRENT_EMAIL_REFILL_METADATA_KEY,
  type CurrentEmailRefillProvider,
} from '@/lib/leads/refillProvenance'
import type { LeadRecord } from '@/lib/leads/types'
import { normalizeEmailAddress } from '@/lib/outreach/email-quality'

export type CurrentEmailReadyRefillProvenanceStore = {
  compareAndSwap: (input: {
    currentLead: LeadRecord
    metadataJson: Record<string, unknown>
    updatedAt: string
  }) => Promise<{ updated: LeadRecord | null; error: unknown | null }>
  readById: (leadId: string) => Promise<{ lead: LeadRecord | null; error: unknown | null }>
}

/**
 * Persists a marker against the canonical post-upsert row. The compare-and-swap
 * retry always rebuilds metadata and the signature from the latest saved row.
 */
export async function persistCurrentEmailReadyRefillProvenanceWithStore(input: {
  lead: LeadRecord
  provider: CurrentEmailRefillProvider
  issuedAt?: Date
  store: CurrentEmailReadyRefillProvenanceStore
}) {
  const issuedAt = input.issuedAt || new Date()
  const canonicalBinding = {
    id: input.lead.id,
    source: String(input.lead.source || ''),
    email: normalizeEmailAddress(input.lead.email),
  }
  let currentLead = input.lead

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (
      currentLead.id !== canonicalBinding.id ||
      String(currentLead.source || '') !== canonicalBinding.source ||
      normalizeEmailAddress(currentLead.email) !== canonicalBinding.email
    ) {
      return currentLead
    }

    const marker = buildCurrentEmailReadyRefillProvenance(currentLead, {
      provider: input.provider,
      issuedAt,
    })
    if (!marker) return currentLead

    const previousUpdatedAtMs = Date.parse(currentLead.updated_at)
    const updatedAt = new Date(Math.max(
      Date.now(),
      Number.isFinite(previousUpdatedAtMs) ? previousUpdatedAtMs + 1 : 0
    )).toISOString()
    const { updated, error: updateError } = await input.store.compareAndSwap({
      currentLead,
      metadataJson: {
        ...(currentLead.metadata_json || {}),
        [CURRENT_EMAIL_REFILL_METADATA_KEY]: marker,
      },
      updatedAt,
    })
    if (updateError) throw updateError
    if (updated) return updated

    const { lead: latest, error: readError } = await input.store.readById(currentLead.id)
    if (readError) throw readError
    if (!latest) throw new Error('Canonical refill lead disappeared before provenance could be persisted.')
    currentLead = latest
  }

  throw new Error('Canonical refill provenance could not be persisted after concurrent lead updates.')
}
