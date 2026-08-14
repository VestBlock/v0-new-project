'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CircleAlert, Loader2, PauseCircle, Plus, ShieldCheck } from 'lucide-react'
import {
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_DEFINITIONS,
  PARTICIPANT_STATUS_LABELS,
  type ParticipantRole,
  type ParticipantStatus,
} from '@/lib/participant-profiles/config'
import styles from './participant-profiles.module.css'

type ProfileSummary = {
  id: string
  role: ParticipantRole
  status: ParticipantStatus
  display_name: string
  organization_name: string
  public_visibility_consent: boolean
  safe_failure_state: string | null
  updated_at: string
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function ParticipantProfilesHome() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/participant-profiles', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to load your profiles.')
      setProfiles(payload.profiles || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load your profiles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const byRole = useMemo(() => new Map(profiles.map((profile) => [profile.role, profile])), [profiles])

  return (
    <main className={styles.shell}>
      <section className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Participant profiles</p>
          <h1>One account. Every role you bring to the table.</h1>
          <p>Create a separate, controlled profile for each way you participate. Each profile has its own criteria, permissions, review status, and history.</p>
        </div>
        <Link className={styles.secondaryButton} href="/workspace">Back to workspace</Link>
      </section>

      <section className={styles.boundaryBar} aria-label="Profile boundaries">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Private by default and controlled by you.</strong>
          <span>Matching, sourcing, and automated outreach do not start from these profiles. Public display requires a separate opt-in and an approved active profile.</span>
        </div>
      </section>

      {error ? <div className={styles.alert} role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div> : null}

      <section className={styles.section} aria-labelledby="owned-profiles-title">
        <header className={styles.sectionHeader}>
          <div><p>Your account</p><h2 id="owned-profiles-title">Saved profiles</h2></div>
          <span>{profiles.length} of {PARTICIPANT_ROLES.length} roles created</span>
        </header>
        {loading ? (
          <div className={styles.loading}><Loader2 className={styles.spin} aria-hidden="true" />Loading profile status…</div>
        ) : profiles.length ? (
          <div className={styles.profileGrid}>
            {profiles.map((profile) => {
              const definition = PARTICIPANT_ROLE_DEFINITIONS[profile.role]
              return (
                <article className={styles.profileCard} key={profile.id}>
                  <div className={styles.cardTop}>
                    <span className={styles.status} data-status={profile.status}>{PARTICIPANT_STATUS_LABELS[profile.status]}</span>
                    <span>{profile.public_visibility_consent ? 'Public permission on' : 'Private'}</span>
                  </div>
                  <h3>{definition.label}</h3>
                  <p>{profile.organization_name || profile.display_name}</p>
                  {profile.safe_failure_state ? <div className={styles.recoverable}><PauseCircle aria-hidden="true" />Saved · follow-up retry available</div> : null}
                  <footer><span>Updated {dateLabel(profile.updated_at)}</span><Link href={'/workspace/profiles/' + profile.id}>Open profile<ArrowRight aria-hidden="true" /></Link></footer>
                </article>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}><h3>No role profiles yet</h3><p>Choose the role that best matches what you want to organize first. You can add other roles later without creating another account.</p></div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="role-picker-title">
        <header className={styles.sectionHeader}>
          <div><p>Add a role</p><h2 id="role-picker-title">What do you want VestBlock to understand?</h2></div>
          <span>Profiles remain separate; your account stays unified.</span>
        </header>
        <div className={styles.roleGrid}>
          {PARTICIPANT_ROLES.map((role, index) => {
            const definition = PARTICIPANT_ROLE_DEFINITIONS[role]
            const existing = byRole.get(role)
            return (
              <article className={styles.roleCard} key={role}>
                <span className={styles.roleNumber}>{String(index + 1).padStart(2, '0')}</span>
                <h3>{definition.label}</h3>
                <p>{definition.description}</p>
                {existing ? (
                  <Link href={'/workspace/profiles/' + existing.id}>Continue profile<ArrowRight aria-hidden="true" /></Link>
                ) : (
                  <Link href={'/workspace/profiles/new?role=' + role}><Plus aria-hidden="true" />Create profile</Link>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
