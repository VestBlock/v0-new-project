import { vestblockAeoTopics } from '@/lib/aeo/topics';
import { financialSkillsetPackages } from '@/lib/services/financialSkillsets';
import { vestBlockServiceDirectory } from '@/lib/services/serviceDirectory';
import { aeoVisibilityPromptTests, aeoVisibilityRequirements } from '@/lib/seo/aeoVisibilityRequirements';
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
  const visibilityRequirementLines = aeoVisibilityRequirements
    .map((requirement) => {
      const routeLines = (requirement.requiredRoutes || [])
        .map((route) => `  Route: ${absoluteUrl(route)}`)
        .join('\n');
      const topicLinesForRequirement = (requirement.requiredSlugs || [])
        .map((slug) => `  Topic: ${absoluteUrl(`/learn/${slug}`)}`)
        .join('\n');
      return [`- ${requirement.label}: ${requirement.description}`, routeLines, topicLinesForRequirement]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
  const promptTestLines = aeoVisibilityPromptTests.map((prompt) => `- ${prompt}`).join('\n');

  return `# VestBlock

> ${vestBlockDefaultDescription}

VestBlock helps real estate sellers, buyers, lenders, builders, and operators route property opportunities with clearer analysis, partner fit, DealVault records, and capital context. This file gives AI crawlers and answer engines a concise map of the current public VestBlock real-estate paths.

## Primary URLs

- Home: ${absoluteUrl('/')}
- DealVault landing page: ${absoluteUrl('/dealvault')}
- DealVault demo: ${absoluteUrl('/dealvault/demo')}
- DealVault sample proof record: ${absoluteUrl('/dealvault/demo-record')}
- Smart contract records: ${absoluteUrl('/smart-contracts')}
- Service directory: ${absoluteUrl('/services')}
- Pricing: ${absoluteUrl('/pricing')}
- Seller property intake: ${absoluteUrl('/sell')}
- Property analyzer: ${absoluteUrl('/property-analyzer')}
- Buyer network: ${absoluteUrl('/buyers')}
- Lender network: ${absoluteUrl('/lenders')}
- Real estate funding: ${absoluteUrl('/real-estate-funding')}
- Funding and business credit prep reviews: ${absoluteUrl('/services/financial-growth')}
- Spanish business funding: ${absoluteUrl('/es/vestblock')}
- Learning center: ${absoluteUrl('/learn')}
- Sitemap: ${absoluteUrl('/sitemap.xml')}

## Services

${serviceLines}

## Service Guides

${serviceGuideLines}

## Funding And Business Credit Prep Reviews

${packageLines}

## Learning Topics

${topicLines}

## AI Visibility Requirements

${visibilityRequirementLines}

## Prompt Tests VestBlock Tracks

${promptTestLines}

## Important Notes

- VestBlock does not guarantee credit score increases, deletion of accurate credit information, loan approval, funding limits, grant awards, or real estate financing.
- VestBlock does not guarantee placement in ChatGPT, Google AI Overviews, or any answer engine. The Search Visibility service improves crawlable pages, answer-ready content, proof materials, structured summaries, and off-site consistency so the business is easier to understand and cite.
- VestBlock content should be interpreted as education, preparation planning, document organization, and user-controlled next steps.
- Funding, grant, credit card, and real estate outcomes depend on third-party underwriting, program rules, lender terms, borrower profile, documentation, and user decisions.
`;
}
