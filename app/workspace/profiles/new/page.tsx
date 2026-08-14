import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/admin'
import { ParticipantProfileWorkbench } from '@/components/participant-profiles/profile-workbench'
import { PARTICIPANT_ROLES, type ParticipantRole } from '@/lib/participant-profiles/config'

export const metadata: Metadata = { title: 'Create Participant Profile', robots: { index: false, follow: false } }

export default async function NewParticipantProfilePage(props: { searchParams: Promise<{ role?: string }> }) {
  const searchParams = await props.searchParams
  const role = PARTICIPANT_ROLES.includes(searchParams.role as ParticipantRole)
    ? searchParams.role as ParticipantRole
    : 'buyer'
  const user = await getServerUser()
  if (!user) redirect('/login?next=' + encodeURIComponent('/workspace/profiles/new?role=' + role))
  return (
    <ParticipantProfileWorkbench
      initialRole={role}
      initialEmail={user.email || ''}
      initialName={user.user_metadata?.full_name || user.email?.split('@')[0] || ''}
    />
  )
}
