import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/admin'
import { ParticipantProfileWorkbench } from '@/components/participant-profiles/profile-workbench'

export const metadata: Metadata = { title: 'Participant Profile', robots: { index: false, follow: false } }

export default async function ParticipantProfilePage(props: { params: Promise<{ id: string }> }) {
  const user = await getServerUser()
  if (!user) redirect('/login?next=%2Fworkspace%2Fprofiles')
  const { id } = await props.params
  return (
    <ParticipantProfileWorkbench
      profileId={id}
      initialRole="buyer"
      initialEmail={user.email || ''}
      initialName={user.user_metadata?.full_name || user.email?.split('@')[0] || ''}
    />
  )
}
