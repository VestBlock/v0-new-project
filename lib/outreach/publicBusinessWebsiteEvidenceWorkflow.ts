import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import {
  assessPublicBusinessWebsiteEvidenceMiss,
  buildPublicBusinessWebsiteContactInfo,
  buildPublicBusinessWebsiteEvidenceMiss,
  metadataWithPublicBusinessWebsiteEvidenceMiss,
  metadataWithoutPublicBusinessWebsiteEvidenceMiss,
  PUBLIC_BUSINESS_WEBSITE_EVIDENCE_MISS_METADATA_KEY,
  type PublicBusinessWebsiteObservation,
} from '@/lib/outreach/publicBusinessWebsiteEvidenceCore'
import {
  deriveRecipientBoundBusinessContactEvidence,
  type VerifiedBusinessContactEvidence,
} from '@/lib/outreach/verifiedBusinessColdEmail'

export type PublicBusinessEvidenceScope = 'buyer' | 'lender' | 'lead'

export type PublicBusinessEvidenceEntity = {
  id: string
  contactEmail: string | null | undefined
  website: string | null | undefined
  contactInfo: Record<string, unknown> | null | undefined
  metadataJson: Record<string, unknown> | null | undefined
  source?: string | null
  updatedAt: string
}

export type PublicBusinessEvidenceRefreshResult = {
  evidence: VerifiedBusinessContactEvidence | null
  contactInfo: Record<string, unknown>
  updatedAt: string
  refreshed: boolean
  retryable: boolean
  reason: string
}

export type PublicBusinessEvidenceStateStore = {
  compareAndSwap: (input: {
    scope: PublicBusinessEvidenceScope
    currentEntity: PublicBusinessEvidenceEntity
    contactInfo: Record<string, unknown>
    metadataJson: Record<string, unknown>
    updatedAt: string
  }) => Promise<{ entity: PublicBusinessEvidenceEntity | null; error: unknown | null }>
  readById: (input: {
    scope: PublicBusinessEvidenceScope
    entityId: string
  }) => Promise<{ entity: PublicBusinessEvidenceEntity | null; error: unknown | null }>
}

type PublicBusinessEvidenceStateResult =
  | { status: 'updated'; entity: PublicBusinessEvidenceEntity }
  | { status: 'concurrent'; entity: PublicBusinessEvidenceEntity | null }
  | { status: 'error'; entity: null }

function nextCasTimestamp(previous: string, now: Date) {
  const previousMs = Date.parse(previous)
  return new Date(Math.max(now.getTime(), Number.isFinite(previousMs) ? previousMs + 1 : 0)).toISOString()
}

function deriveFromEntity(entity: PublicBusinessEvidenceEntity, now: Date) {
  return deriveRecipientBoundBusinessContactEvidence({
    source: entity.source,
    metadataJson: entity.metadataJson,
    contactInfo: entity.contactInfo,
    recipientEmail: entity.contactEmail,
    website: entity.website,
    now,
  })
}

export function samePublicBusinessEvidenceEntityBinding(
  left: PublicBusinessEvidenceEntity,
  right: PublicBusinessEvidenceEntity
) {
  return left.id === right.id &&
    normalizeEmailAddress(left.contactEmail) === normalizeEmailAddress(right.contactEmail) &&
    left.website === right.website
}

export async function persistPublicBusinessEvidenceState(input: {
  scope: PublicBusinessEvidenceScope
  entity: PublicBusinessEvidenceEntity
  now: Date
  store: PublicBusinessEvidenceStateStore
  buildState: (current: PublicBusinessEvidenceEntity) => {
    contactInfo: Record<string, unknown>
    metadataJson: Record<string, unknown>
  }
}): Promise<PublicBusinessEvidenceStateResult> {
  let currentEntity = input.entity

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!samePublicBusinessEvidenceEntityBinding(currentEntity, input.entity)) {
      return { status: 'concurrent', entity: currentEntity }
    }
    const next = input.buildState(currentEntity)
    const updatedAt = nextCasTimestamp(currentEntity.updatedAt, input.now)
    const { entity: updated, error: updateError } = await input.store.compareAndSwap({
      scope: input.scope,
      currentEntity,
      contactInfo: next.contactInfo,
      metadataJson: next.metadataJson,
      updatedAt,
    })
    if (updateError) return { status: 'error', entity: null }
    if (updated) return { status: 'updated', entity: updated }

    const { entity: latest, error: readError } = await input.store.readById({
      scope: input.scope,
      entityId: currentEntity.id,
    })
    if (readError) return { status: 'error', entity: null }
    if (!latest) return { status: 'concurrent', entity: null }
    currentEntity = latest
  }

  return { status: 'concurrent', entity: currentEntity }
}

export async function runPublicBusinessWebsiteEvidenceWorkflow(input: {
  scope: PublicBusinessEvidenceScope
  entity: PublicBusinessEvidenceEntity
  now?: Date
  store: PublicBusinessEvidenceStateStore
  observe: (input: {
    website: string | null | undefined
    recipientEmail: string
  }) => Promise<PublicBusinessWebsiteObservation>
}): Promise<PublicBusinessEvidenceRefreshResult> {
  const now = input.now || new Date()
  const existingEvidence = deriveFromEntity(input.entity, now)
  if (existingEvidence) {
    const hasStaleMissMarker = Boolean(
      input.entity.metadataJson?.[PUBLIC_BUSINESS_WEBSITE_EVIDENCE_MISS_METADATA_KEY]
    )
    const cleared = hasStaleMissMarker
      ? await persistPublicBusinessEvidenceState({
          scope: input.scope,
          entity: input.entity,
          now,
          store: input.store,
          buildState: (current) => ({
            contactInfo: current.contactInfo || {},
            metadataJson: metadataWithoutPublicBusinessWebsiteEvidenceMiss(current.metadataJson),
          }),
        })
      : null
    return {
      evidence: existingEvidence,
      contactInfo: cleared?.entity?.contactInfo || input.entity.contactInfo || {},
      updatedAt: cleared?.entity?.updatedAt || input.entity.updatedAt,
      refreshed: false,
      retryable: false,
      reason: 'business_contact_evidence_already_fresh',
    }
  }

  const recipientEmail = normalizeEmailAddress(input.entity.contactEmail)
  if (!isUsableContactEmail(recipientEmail)) {
    return {
      evidence: null,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: false,
      reason: 'business_contact_evidence_recipient_invalid',
    }
  }

  const cachedMiss = assessPublicBusinessWebsiteEvidenceMiss({
    metadataJson: input.entity.metadataJson,
    recipientEmail,
    website: input.entity.website,
    now,
  })
  if (cachedMiss.active) {
    return {
      evidence: null,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: false,
      reason: `business_contact_evidence_refresh_terminal_miss_cached:${cachedMiss.record?.reason || 'terminal_miss'}`,
    }
  }

  const observation = await input.observe({
    website: input.entity.website,
    recipientEmail,
  })
  if (observation.status === 'unavailable') {
    return {
      evidence: null,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: true,
      reason: `business_contact_evidence_refresh_${observation.reason}`,
    }
  }

  if (observation.status !== 'found') {
    const miss = buildPublicBusinessWebsiteEvidenceMiss({
      recipientEmail,
      website: input.entity.website,
      reason: observation.reason,
      checkedAt: now.toISOString(),
    })
    const persistedMiss = await persistPublicBusinessEvidenceState({
      scope: input.scope,
      entity: input.entity,
      now,
      store: input.store,
      buildState: (current) => {
        const concurrentPositiveEvidence = deriveFromEntity(current, now)
        return {
          contactInfo: current.contactInfo || {},
          metadataJson: concurrentPositiveEvidence
            ? metadataWithoutPublicBusinessWebsiteEvidenceMiss(current.metadataJson)
            : metadataWithPublicBusinessWebsiteEvidenceMiss(current.metadataJson, miss),
        }
      },
    })
    if (persistedMiss.status === 'error') {
      return {
        evidence: null,
        contactInfo: input.entity.contactInfo || {},
        updatedAt: input.entity.updatedAt,
        refreshed: false,
        retryable: true,
        reason: 'business_contact_evidence_refresh_terminal_miss_persistence_failed',
      }
    }

    const persistedEntity = persistedMiss.entity
    if (persistedMiss.status === 'concurrent') {
      const concurrentEvidence = persistedEntity &&
        samePublicBusinessEvidenceEntityBinding(persistedEntity, input.entity)
        ? deriveFromEntity(persistedEntity, now)
        : null
      if (concurrentEvidence) {
        return {
          evidence: concurrentEvidence,
          contactInfo: persistedEntity?.contactInfo || input.entity.contactInfo || {},
          updatedAt: persistedEntity?.updatedAt || input.entity.updatedAt,
          refreshed: false,
          retryable: false,
          reason: 'business_contact_evidence_refreshed_concurrently',
        }
      }
      const concurrentMiss = persistedEntity &&
        samePublicBusinessEvidenceEntityBinding(persistedEntity, input.entity)
        ? assessPublicBusinessWebsiteEvidenceMiss({
            metadataJson: persistedEntity.metadataJson,
            recipientEmail,
            website: input.entity.website,
            now,
          })
        : null
      if (concurrentMiss?.active) {
        return {
          evidence: null,
          contactInfo: persistedEntity?.contactInfo || input.entity.contactInfo || {},
          updatedAt: persistedEntity?.updatedAt || input.entity.updatedAt,
          refreshed: false,
          retryable: false,
          reason: `business_contact_evidence_refresh_terminal_miss_cached:${concurrentMiss.record?.reason || observation.reason}`,
        }
      }
      return {
        evidence: null,
        contactInfo: persistedEntity?.contactInfo || input.entity.contactInfo || {},
        updatedAt: persistedEntity?.updatedAt || input.entity.updatedAt,
        refreshed: false,
        retryable: true,
        reason: 'business_contact_evidence_refresh_concurrent_change',
      }
    }

    const persistedPositiveEvidence = persistedEntity
      ? deriveFromEntity(persistedEntity, now)
      : null
    if (persistedPositiveEvidence) {
      return {
        evidence: persistedPositiveEvidence,
        contactInfo: persistedEntity?.contactInfo || input.entity.contactInfo || {},
        updatedAt: persistedEntity?.updatedAt || input.entity.updatedAt,
        refreshed: false,
        retryable: false,
        reason: 'business_contact_evidence_refreshed_concurrently',
      }
    }

    return {
      evidence: null,
      contactInfo: persistedEntity?.contactInfo || input.entity.contactInfo || {},
      updatedAt: persistedEntity?.updatedAt || input.entity.updatedAt,
      refreshed: false,
      retryable: false,
      reason: `business_contact_evidence_refresh_${observation.reason}_quarantined`,
    }
  }

  const observedAt = now.toISOString()
  const persistedEvidence = await persistPublicBusinessEvidenceState({
    scope: input.scope,
    entity: input.entity,
    now,
    store: input.store,
    buildState: (current) => ({
      contactInfo: buildPublicBusinessWebsiteContactInfo({
        existingContactInfo: current.contactInfo,
        recipientEmail,
        sourceUrl: observation.sourceUrl,
        attemptedUrls: observation.attemptedUrls,
        observedAt,
      }),
      metadataJson: metadataWithoutPublicBusinessWebsiteEvidenceMiss(current.metadataJson),
    }),
  })
  if (persistedEvidence.status === 'error') {
    return {
      evidence: null,
      contactInfo: input.entity.contactInfo || {},
      updatedAt: input.entity.updatedAt,
      refreshed: false,
      retryable: true,
      reason: 'business_contact_evidence_refresh_persistence_failed',
    }
  }

  if (persistedEvidence.status === 'concurrent') {
    const concurrentEntity = persistedEvidence.entity
    const concurrentEvidence = concurrentEntity &&
      samePublicBusinessEvidenceEntityBinding(concurrentEntity, input.entity)
      ? deriveFromEntity(concurrentEntity, now)
      : null
    return {
      evidence: concurrentEvidence || null,
      contactInfo: concurrentEntity?.contactInfo || input.entity.contactInfo || {},
      updatedAt: concurrentEntity?.updatedAt || input.entity.updatedAt,
      refreshed: false,
      retryable: !concurrentEvidence,
      reason: concurrentEvidence
        ? 'business_contact_evidence_refreshed_concurrently'
        : 'business_contact_evidence_refresh_concurrent_change',
    }
  }

  const updatedEntity = persistedEvidence.entity
  const evidence = deriveFromEntity(updatedEntity, now)
  return {
    evidence,
    contactInfo: updatedEntity.contactInfo || {},
    updatedAt: updatedEntity.updatedAt,
    refreshed: Boolean(evidence),
    retryable: !evidence,
    reason: evidence
      ? 'business_contact_evidence_refreshed'
      : 'business_contact_evidence_refresh_persisted_evidence_invalid',
  }
}
