import { vestBlockServiceDirectory } from '@/lib/services/serviceDirectory';
import { financialSkillsetPackages } from '@/lib/services/financialSkillsets';
import { absoluteUrl, vestBlockDefaultDescription, vestBlockSiteName } from '@/lib/seo/site';

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: vestBlockSiteName,
    url: absoluteUrl('/'),
    description: vestBlockDefaultDescription,
    sameAs: ['https://www.vestblock.io'],
    areaServed: 'US',
    knowsAbout: [
      'AI credit repair',
      'credit dispute letters',
      'business funding preparation',
      'business credit line preparation',
      'business credit',
      'small business grants',
      'Spanish business funding',
      'real estate funding',
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
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl('/learn')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function servicesItemListJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'VestBlock financial services',
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
    name: 'VestBlock Financial Growth Services',
    url: absoluteUrl('/services/financial-growth'),
    description:
      'Paid financial prep packages for funding preparation, business credit, grant applications, debt utilization, cash-flow document review, and real estate deal review.',
    provider: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    areaServed: 'US',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'VestBlock financial prep packages',
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
          text: 'DealVault is a VestBlock module for recording real estate deal proofs, referral and JV payout ledgers, and contractor milestone records with a blockchain-backed audit trail.',
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
          text: 'No. The current DealVault release is an audit and proof layer. It does not provide custody, escrow, tokenized ownership, or live movement of customer funds on-chain.',
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
