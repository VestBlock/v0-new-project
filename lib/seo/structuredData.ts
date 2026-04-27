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
      'business funding readiness',
      'credit card stacking preparation',
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
      'Paid financial prep packages for funding readiness, business credit, grant applications, debt utilization, cash-flow document review, and real estate deal review.',
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
          text: 'No. VestBlock packages help organize readiness, documents, credit factors, and next steps. Approval, funding limits, grant awards, and terms depend on lenders, programs, underwriting, and user decisions.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which financial prep service should a business owner start with?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Most owners should start with the free business funding eligibility check. If the profile needs preparation before applying, VestBlock can route the owner to a paid readiness or financial prep package.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can VestBlock help with credit card stacking preparation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'VestBlock can review readiness for a credit card funding strategy, organize documents, explain risk factors, and prepare next steps before applications. Customers should review all terms and understand repayment responsibilities.',
        },
      },
    ],
  };
}

