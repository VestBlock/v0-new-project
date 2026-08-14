import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  PARTICIPANT_ROLE_DEFINITIONS,
  type ParticipantRole,
} from '@/lib/participant-profiles/config'
import { publicSlugSchema } from '@/lib/participant-profiles/schemas'
import {
  publicParticipantProfile,
  type ParticipantProfileRecord,
} from '@/lib/participant-profiles/server'
import { createAdminClient } from '@/lib/supabase/admin'
import styles from '@/components/participant-profiles/participant-profiles.module.css'

export const metadata: Metadata = {
  title: 'Participant Profile',
  description: 'An approved VestBlock participant profile.',
}

export const dynamic = 'force-dynamic'

export default async function PublicParticipantProfilePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  if (!publicSlugSchema.safeParse(slug).success) notFound()
  const admin = createAdminClient()
  const { data } = await admin.from('participant_profiles')
    .select('*')
    .eq('public_slug', slug)
    .eq('origin', 'customer')
    .eq('status', 'active')
    .eq('public_visibility_consent', true)
    .not('public_visibility_consented_at', 'is', null)
    .maybeSingle()
  if (!data) notFound()
  const profile = publicParticipantProfile(data as ParticipantProfileRecord)
  const definition = PARTICIPANT_ROLE_DEFINITIONS[profile.role as ParticipantRole]
  const labels = new Map(definition.fields.map((field) => [field.key, field.label]))
  return (
    <main className={styles.shell}>
      <section className={styles.masthead}>
        <div>
          <p className={styles.kicker}>Approved participant profile</p>
          <h1>{profile.organizationName || profile.displayName}</h1>
          <p>{profile.roleLabel}{profile.summary ? ' · ' + profile.summary : ''}</p>
        </div>
      </section>
      <section className={styles.boundaryBar}>
        <div>
          <strong>Public fields selected by the profile owner</strong>
          <span>{profile.providerSuppliedBoundary}</span>
        </div>
      </section>
      <section className={styles.section}>
        <header className={styles.sectionHeader}><div><p>Profile criteria</p><h2>Approved public context</h2></div><span>Private contact information and internal VestBlock records are not displayed.</span></header>
        <dl className={styles.reviewGrid}>
          {Object.entries(profile.criteria).map(([key, value]) => (
            <div key={key}><dt>{labels.get(key) || key}</dt><dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>
          ))}
        </dl>
      </section>
    </main>
  )
}
