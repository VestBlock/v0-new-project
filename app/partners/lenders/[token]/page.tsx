import { LenderPartnerPortal } from '@/components/partners/lender-partner-portal'

export const dynamic = 'force-dynamic'

export default async function LenderPartnerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return <LenderPartnerPortal token={token} />
}
