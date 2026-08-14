import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/admin'
import { ParticipantProfilesHome } from '@/components/participant-profiles/profile-list'

export const metadata: Metadata = {
  title: 'Participant Profiles',
  description: 'Manage private VestBlock role profiles, criteria, permissions, and review status.',
  robots: { index: false, follow: false },
}

export default async function ParticipantProfilesPage() {
  const user = await getServerUser()
  if (!user) redirect('/login?next=%2Fworkspace%2Fprofiles')
  return <ParticipantProfilesHome />
}
