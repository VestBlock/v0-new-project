import { vestBlockServiceDirectory } from '@/lib/services/serviceDirectory';
import { financialSkillsetPackages } from '@/lib/services/financialSkillsets';
import { visibilityExpansionPackages } from '@/lib/services/visibilityExpansionPackages';
import { absoluteUrl, vestBlockDefaultDescription, vestBlockSiteName } from '@/lib/seo/site';
import type { FaqItem } from '@/lib/seo/faqContent';

/**
 * VestBlock verified external profiles for the Organization `sameAs` entity graph.
 * AEO note: populating these with REAL, verifiable profiles (LinkedIn company page,
 * Crunchbase, X/Twitter, BBB, etc.) is one of the strongest entity-authority signals
 * for AI search engines. Only add URLs that resolve to official VestBlock profiles —
 * do not add placeholders. The site URL is always included.
 *
 * TODO(vestblock): add real profile URLs, e.g.
 *   'https://www.linkedin.com/company/vestblock',
 *   'https://www.crunchbase.com/organization/vestblock',
 *   'https://x.com/vestblock',
 */
export const vestBlockSameAs: string[] = [
  'https://www.vestblock.io',
];

/** Generic FAQPage builder shared by all pages that render a visible FaqSection. */
export function faqPageJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: vestBlockSiteName,
    url: absoluteUrl('/'),
    description:
      'VestBlock is a real estate partner network connecting property sellers, buyers, lenders, developers, contractors, and operators through property review, partner introductions, DealVault records, and funding-ready next steps.',
    sameAs: vestBlockSameAs,
    areaServed: 'US',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-414-687-6923',
      email: 'contact@vestblock.io',
      contactType: 'customer support',
      areaServed: 'US',
    },
    knowsAbout: [
      'real estate partner introductions',
      'seller property review',
      'buyer buy box criteria matching',
      'private lender deal review',
      'hard money lender matching',
      'real estate developer network',
      'construction company project partnerships',
      'contractor partner network',
      'DealVault blockchain-backed records',
      'real estate agreement proof',
      'deal milestone tracking',
      'payout ledger and partner splits',
      'real estate funding review',
      'No Limit Capital partner funding review',
      'DSCR loan matching',
      'fix and flip deal review',
      'bridge loan review',
      'ground-up construction loan review',
      'cash buyer network',
      'business funding preparation',
      'AI receptionist setup',
    ],
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: vestBlockSiteName,
    url: absoluteUrl('/'),
    description: vestBlockDefaultDescription,
  };
}

export function servicesItemListJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'VestBlock services',
    itemListElement: vestBlockServiceDirectory.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.title,
        url: absoluteUrl(service.route.split('#')[0]),
        description: service.summary,
        audience: service.bestFor,
        provider: {
          '@type': 'Organization',
          name: vestBlockSiteName,
          url: absoluteUrl('/'),
        },
        termsOfService: service.trustNote,
      },
    })),
  };
}

export function financialGrowthServiceJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'VestBlock Funding & Business Credit Prep Reviews',
    url: absoluteUrl('/services/financial-growth'),
    description:
      'Focused prep reviews for funding readiness, business credit, grant applications, debt utilization, cash-flow document review, and real estate deal review.',
    provider: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    areaServed: 'US',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'VestBlock prep reviews',
      itemListElement: financialSkillsetPackages.map((servicePackage) => ({
        '@type': 'Offer',
        name: servicePackage.title,
        description: servicePackage.summary,
        price: servicePackage.price.replace(/[^0-9.]/g, ''),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: absoluteUrl('/services/financial-growth#request-service'),
        itemOffered: {
          '@type': 'Service',
          name: servicePackage.title,
          description: servicePackage.bestFor,
        },
      })),
    },
  };
}

export function financialGrowthFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Does VestBlock guarantee funding, grants, or credit approval?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. VestBlock packages help organize preparation, documents, credit factors, and next steps. Approval, funding limits, grant awards, and terms depend on lenders, programs, underwriting, and user decisions.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which financial prep service should a business owner start with?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Most owners should start with the free business funding eligibility check. If the profile needs preparation before applying, VestBlock can recommend a paid funding-prep or financial review package.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can VestBlock help with business credit line preparation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'VestBlock can review preparation needs for a business credit funding strategy, organize documents, explain risk factors, and prepare next steps before applications. Customers should review all terms and understand repayment responsibilities.',
        },
      },
    ],
  };
}

export function dealVaultServiceJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'DealVault by VestBlock',
    url: absoluteUrl('/dealvault'),
    description:
      'Blockchain-backed agreement proof, payout split tracking, and milestone tracking for real estate teams, private lenders, contractors, referral partners, and service businesses.',
    provider: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    areaServed: 'US',
    audience: {
      '@type': 'Audience',
      audienceType:
        'Real estate investors, contractors, private lenders, referral partners, staffing teams, agencies, and service businesses',
    },
    offers: {
      '@type': 'Offer',
      url: absoluteUrl('/dealvault'),
      availability: 'https://schema.org/PreOrder',
      priceCurrency: 'USD',
    },
  };
}

export function dealVaultFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is DealVault by VestBlock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'DealVault is a VestBlock product for recording real estate deal details, referral and JV payout ledgers, and contractor milestone records with a blockchain-backed audit trail.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does DealVault store property addresses or private contracts on-chain?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. DealVault stores hashes, proof IDs, timestamps, statuses, and opaque record references on-chain. Sensitive property, agreement, and participant details stay off-chain in the application database.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is DealVault moving escrow or investor funds on-chain?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. The current DealVault release creates audit and verification records. It does not provide custody, escrow, tokenized ownership, or live movement of customer funds on-chain.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who is DealVault for?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'DealVault is designed for real estate teams, contractors, private lenders, referral partners, agencies, staffing teams, and businesses that need a clearer proof and payout trail around important agreements.',
        },
      },
    ],
  };
}

export function aiAssistantServiceJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'VestBlock AI Receptionist and Website Upgrade Services',
    url: absoluteUrl('/ai-assistant'),
    description:
      'AI receptionist, appointment-booking, and website-upgrade services for service businesses that need stronger lead capture, cleaner follow-up, and better booking flow.',
    provider: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    areaServed: 'US',
    audience: {
      '@type': 'Audience',
      audienceType:
        'Service businesses that need stronger lead capture, booking automation, and website conversion support',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'VestBlock AI receptionist and website offers',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'AI Receptionist Launch',
          url: absoluteUrl('/ai-assistant?package=ai_receptionist_launch'),
          price: '495',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'AI Receptionist + Appointment Booking',
          url: absoluteUrl('/ai-assistant?package=appointment_booking_system'),
          price: '895',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        {
          '@type': 'Offer',
          name: 'Website Upgrade Sprint',
          url: absoluteUrl('/ai-assistant?package=website_upgrade_sprint'),
          price: '2500',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      ],
    },
  };
}

export function visibilityExpansionServiceJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'VestBlock AEO/SEO Booster',
    url: absoluteUrl('/visibility-expansion'),
    description:
      'Productized AEO/SEO Booster packages for service businesses: clearer crawlable pages, city expansion support, answer-engine readiness, and authority-building without ranking or citation guarantees.',
    provider: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    areaServed: 'US',
    audience: {
      '@type': 'Audience',
      audienceType:
        'Service businesses improving SEO, AEO, city coverage, and authority signals',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'VestBlock visibility packages',
      itemListElement: visibilityExpansionPackages.map((servicePackage) => ({
        '@type': 'Offer',
        name: servicePackage.title,
        description: servicePackage.summary,
        price: String(servicePackage.amount),
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: absoluteUrl(
          `/visibility-expansion?package=${servicePackage.key}#request-visibility-review`
        ),
        itemOffered: {
          '@type': 'Service',
          name: servicePackage.title,
          description: servicePackage.bestFor,
        },
      })),
    },
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Homepage FAQ structured data for search engines and answer tools. */
export function homepageFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is VestBlock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'VestBlock is a real estate intake, referral, and record-keeping platform that connects property sellers, buyers, and lenders through structured review. It also provides DealVault, a blockchain-backed record product for agreement milestones, payout ledgers, and deal records.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does VestBlock connect real estate opportunities?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sellers submit property details through the seller form. Buyers share their buy box — markets, asset types, price range, proof status, and no-go items. Lenders share their lending criteria. VestBlock routes each submission so the right conversations can be reviewed before a formal connection is made.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is DealVault by VestBlock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'DealVault is a blockchain-backed record and accountability product for real estate teams, private lenders, contractors, agencies, and referral partners. It records agreement details, payout splits, partner milestones, and audit trails without storing sensitive documents on-chain.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who should use VestBlock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'VestBlock is designed for property sellers looking to explore sale options, real estate buyers sharing acquisition criteria, private lenders wanting to receive matched deal flow, and deal operators who need cleaner records through DealVault. Supporting services are available for funding prep, business credit, and AI reception.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do sellers submit a property to VestBlock?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sellers visit vestblock.io/sell to submit their property address, condition, timeline, asking price, mortgage balance, preferred sale path, and situation. VestBlock routes the details to acquisitions review for fast cash buyer review, creative structure review, novation review, or another partner follow-up.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do buyers join the VestBlock buyer network?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Buyers visit vestblock.io/buyers to share their buy box: target markets, asset types, price range, typical closing speed, proof of funds status, preferred deal structures, and no-go criteria. VestBlock stores the criteria and can introduce matching seller opportunities for review.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do lenders join the VestBlock lender network?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Lenders visit vestblock.io/lenders to share their lending box: states served, loan amount range, preferred deal types, minimum credit or DSCR requirements, and no-go items. VestBlock uses the criteria to introduce matching real estate borrower and deal opportunities to the right lender for review.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does VestBlock guarantee deals, closings, or funding?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. VestBlock is a real estate intake, referral, and record-keeping platform, not a lender, buyer, or closing agent. It does not guarantee deal volume, closings, approvals, funding terms, or investment returns. Referrals are subject to match quality, criteria fit, and review by both parties.',
        },
      },
    ],
  };
}

/** Real estate partner service schema for seller/buyer/lender pages. */
export function realEstatePartnerServiceJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'VestBlock Real Estate Partner Network',
    url: absoluteUrl('/'),
    description:
      'VestBlock connects real estate seller opportunities with buyer, lender, developer, contractor, operator, and capital partner conversations using clear review forms, buy-box criteria, lender requirements, and DealVault records.',
    provider: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    areaServed: 'US',
    audience: {
      '@type': 'Audience',
      audienceType:
        'Property sellers, real estate buyers, private lenders, hard money lenders, and deal operators',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'VestBlock real estate partner paths',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Seller Property Review',
          url: absoluteUrl('/sell'),
          description: 'Sellers submit property details for fast cash buyer, creative structure, novation, or partner sale review.',
          availability: 'https://schema.org/InStock',
          price: '0',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Buyer Buy Box Network',
          url: absoluteUrl('/buyers'),
          description: 'Real estate buyers share acquisition criteria so matching seller opportunities can be introduced for review, with No Limit Capital or another partner funding review available when capital fit matters.',
          availability: 'https://schema.org/InStock',
          price: '0',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Investor Funding Review',
          url: absoluteUrl('/real-estate-funding'),
          description: 'Investor buyers and operators can submit DSCR, fix-and-flip, bridge, hard-money, or ground-up construction scenarios so VestBlock can organize the context for No Limit Capital or another better-fit lender review.',
          availability: 'https://schema.org/InStock',
          price: '0',
          priceCurrency: 'USD',
        },
        {
          '@type': 'Offer',
          name: 'Lender Network Signup',
          url: absoluteUrl('/lenders'),
          description: 'Private lenders and hard money lenders share lending criteria so matching real estate deals can be introduced for funding review.',
          availability: 'https://schema.org/InStock',
          price: '0',
          priceCurrency: 'USD',
        },
      ],
    },
  };
}

export function articleJsonLd(input: {
  headline: string;
  description: string;
  path: string;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  inLanguage?: string;
  keywords?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntityOfPage: absoluteUrl(input.path),
    publisher: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    author: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    datePublished: input.publishedAt || undefined,
    dateModified: input.modifiedAt || input.publishedAt || undefined,
    inLanguage: input.inLanguage || 'en',
    keywords: input.keywords?.length ? input.keywords.join(', ') : undefined,
  };
}
