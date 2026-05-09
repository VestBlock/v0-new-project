import { BuyerPartnerPortal } from '@/components/partners/buyer-partner-portal'

export const dynamic = 'force-dynamic'

export default async function BuyerPartnerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  return <BuyerPartnerPortal token={token} />
}
