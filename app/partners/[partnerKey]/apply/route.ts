import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/admin';
import { getPartnerReferralDefinition } from '@/lib/partners/referrals';
import { absoluteUrl } from '@/lib/seo/site';
import { logEvent } from '@/lib/system/logEvent';
import { captureServerEvent } from '@/lib/analytics/server';
import { analyticsEvents } from '@/lib/analytics/events';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerKey: string }> }
) {
  const { partnerKey } = await params;
  const definition = getPartnerReferralDefinition(partnerKey);

  if (!definition) {
    return NextResponse.redirect(absoluteUrl('/real-estate-funding'));
  }

  const searchParams = request.nextUrl.searchParams;
  const source =
    searchParams.get('source') || 'real-estate-funding';
  const leadId = searchParams.get('leadId');
  const loanType = searchParams.get('loanType');
  const service = searchParams.get('service');
  const packageKey = searchParams.get('package');
  const user = await getServerUser();
  const clickId = randomUUID();
  const destination = new URL(definition.destinationUrl);

  if (definition.trackingMode === 'utm') {
    destination.searchParams.set('utm_source', 'vestblock');
    destination.searchParams.set('utm_medium', 'referral');
    destination.searchParams.set('utm_campaign', definition.utmCampaign);
    destination.searchParams.set('utm_content', source);
  } else {
    destination.searchParams.set('vb_source', 'vestblock');
    destination.searchParams.set('vb_medium', 'referral');
    destination.searchParams.set('vb_campaign', definition.utmCampaign);
    destination.searchParams.set('vb_content', source);
  }

  destination.searchParams.set('vestblock_ref', clickId);
  destination.searchParams.set('vestblock_partner', definition.slug);

  if (leadId) destination.searchParams.set('vestblock_lead_id', leadId);
  if (loanType) destination.searchParams.set('vestblock_loan_type', loanType);
  if (service) destination.searchParams.set('vestblock_service', service);
  if (packageKey) destination.searchParams.set('vestblock_package', packageKey);

  await Promise.allSettled([
    logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id ?? null,
      entityType: 'partner_referral',
      entityId: leadId || clickId,
      metadata: {
        action: 'partner_referral_click',
        clickId,
        partnerKey: definition.key,
        partnerName: definition.displayName,
        source,
        leadId,
        loanType,
        service,
        packageKey,
        destinationUrl: destination.toString(),
        userEmail: user?.email ?? null,
      },
    }),
    captureServerEvent({
      distinctId: user?.id || user?.email || `partner:${clickId}`,
      event: analyticsEvents.partnerReferralClicked,
      properties: {
        clickId,
        partnerKey: definition.key,
        partnerName: definition.displayName,
        source,
        leadId,
        loanType,
        service,
        packageKey,
      },
    }),
  ]);

  return NextResponse.redirect(destination, { status: 302 });
}
