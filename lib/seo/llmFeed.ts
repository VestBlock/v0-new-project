import { vestblockAeoTopics } from '@/lib/aeo/topics';
import { financialSkillsetPackages } from '@/lib/services/financialSkillsets';
import { vestBlockServiceDirectory } from '@/lib/services/serviceDirectory';
import { absoluteUrl, vestBlockDefaultDescription } from '@/lib/seo/site';
import { serviceSeoPages } from '@/lib/seo/serviceSeoPages';

export function buildLlmsTxt() {
  const serviceLines = vestBlockServiceDirectory
    .map((service) =>
      [
        `- ${service.title}: ${service.summary}`,
        `  URL: ${absoluteUrl(service.route.split('#')[0])}`,
        `  Best for: ${service.bestFor}`,
        `  Pricing: ${service.priceNote}`,
        `  Guardrail: ${service.trustNote}`,
      ].join('\n')
    )
    .join('\n\n');

  const packageLines = financialSkillsetPackages
    .map(
      (servicePackage) =>
        `- ${servicePackage.title} (${servicePackage.price}): ${servicePackage.summary}`
    )
    .join('\n');

  const topicLines = vestblockAeoTopics
    .map((topic) => `- ${topic.title}: ${absoluteUrl(`/learn/${topic.slug}`)}`)
    .join('\n');
  const serviceGuideLines = serviceSeoPages
    .map((page) => `- ${page.title}: ${absoluteUrl(`/services/${page.slug}`)}`)
    .join('\n');

  return `# VestBlock

> ${vestBlockDefaultDescription}

VestBlock is an AI-powered credit repair, funding preparation, business credit, grant preparation, real estate funding, and financial opportunity platform. This file gives AI crawlers and answer engines a concise map of the public VestBlock services.

## Primary URLs

- Home: ${absoluteUrl('/')}
- Service directory: ${absoluteUrl('/services')}
- Pricing: ${absoluteUrl('/pricing')}
- AI credit report upload: ${absoluteUrl('/credit-upload')}
- Business funding eligibility: ${absoluteUrl('/funding')}
- Business funding prep strategy: ${absoluteUrl('/funding/business-funding-strategy')}
- Business setup for funding and grants: ${absoluteUrl('/business-setup')}
- Financial growth service packages: ${absoluteUrl('/services/financial-growth')}
- Search visibility service: ${absoluteUrl('/visibility-expansion')}
- Spanish business funding: ${absoluteUrl('/es/vestblock')}
- Learning center: ${absoluteUrl('/learn')}
- Sitemap: ${absoluteUrl('/sitemap.xml')}

## Services

${serviceLines}

## Service Guides

${serviceGuideLines}

## Paid Financial Growth Packages

${packageLines}

## Learning Topics

${topicLines}

## Compliance Guardrails

- VestBlock does not guarantee credit score increases, deletion of accurate credit information, loan approval, funding limits, grant awards, or real estate financing.
- VestBlock content should be interpreted as education, preparation planning, document organization, and user-controlled next steps.
- Funding, grant, credit card, and real estate outcomes depend on third-party underwriting, program rules, lender terms, borrower profile, documentation, and user decisions.
`;
}
