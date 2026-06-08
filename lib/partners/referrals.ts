export type PartnerReferralKey = 'kiavi' | 'rcn' | 'nlc';

type PartnerReferralDefinition = {
  key: PartnerReferralKey;
  displayName: string;
  slug: string;
  destinationUrl: string;
  utmCampaign: string;
  trackingMode: 'vestblock_only' | 'utm';
  fitSummary: string;
  disclosure: string;
  ctaLabel: string;
};

export const partnerReferralDefinitions: Record<
  PartnerReferralKey,
  PartnerReferralDefinition
> = {
  kiavi: {
    key: 'kiavi',
    displayName: 'Kiavi',
    slug: 'kiavi',
    destinationUrl: 'https://try.kiavi.com/p1sqkceu9o8w',
    utmCampaign: 'kiavi',
    trackingMode: 'vestblock_only',
    fitSummary:
      'Best for rental-property and DSCR-style scenarios where the property, reserves, and timing are already fairly clear.',
    disclosure:
      'External partner page. Final terms, approvals, and eligibility come from Kiavi.',
    ctaLabel: 'Open Kiavi Partner Path',
  },
  rcn: {
    key: 'rcn',
    displayName: 'RCN Brokerage Intake',
    slug: 'rcn',
    destinationUrl:
      'https://broker.commerciallendingservicesllc.com/loans/loan-requests/referral_intake_broker',
    utmCampaign: 'rcn',
    trackingMode: 'utm',
    fitSummary:
      'Best for brokered commercial, bridge, or complex real-estate files that may need a wider capital conversation.',
    disclosure:
      'External broker-portal intake. The current destination is brokerage-wide and may require partner login, so this path is best used after VestBlock review.',
    ctaLabel: 'Open Broker Portal Intake',
  },
  nlc: {
    key: 'nlc',
    displayName: 'No Limit Capital',
    slug: 'no-limit-capital',
    destinationUrl: 'https://app.nlcfund.com',
    utmCampaign: 'no-limit-capital',
    trackingMode: 'utm',
    fitSummary:
      'Best for investor buyers who need fix-and-flip, bridge, DSCR, or ground-up construction capital reviewed with a capital partner.',
    disclosure:
      'External No Limit Capital partner path. Final terms, approvals, pricing, leverage, appraisal requirements, and eligibility are determined by No Limit Capital.',
    ctaLabel: 'Open No Limit Capital Path',
  },
};

type BuildPartnerReferralPathInput = {
  partnerKey: PartnerReferralKey;
  source?: string | null;
  leadId?: string | null;
  loanType?: string | null;
  service?: string | null;
  packageKey?: string | null;
};

export function getPartnerReferralDefinition(
  partnerKey: string
): PartnerReferralDefinition | null {
  if (Object.prototype.hasOwnProperty.call(partnerReferralDefinitions, partnerKey)) {
    return partnerReferralDefinitions[partnerKey as PartnerReferralKey];
  }

  return null;
}

export function buildPartnerReferralPath(
  input: BuildPartnerReferralPathInput
) {
  const params = new URLSearchParams();

  if (input.source) params.set('source', input.source);
  if (input.leadId) params.set('leadId', input.leadId);
  if (input.loanType) params.set('loanType', input.loanType);
  if (input.service) params.set('service', input.service);
  if (input.packageKey) params.set('package', input.packageKey);

  const query = params.toString();
  return `/partners/${input.partnerKey}/apply${query ? `?${query}` : ''}`;
}
