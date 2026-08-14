import type { Metadata } from 'next'
import { ParticipantProfileAdminDashboard } from '@/components/participant-profiles/admin-profile-dashboard'

export const metadata: Metadata = { title: 'Participant Profiles' }
export default function AdminParticipantProfilesPage() { return <ParticipantProfileAdminDashboard /> }
