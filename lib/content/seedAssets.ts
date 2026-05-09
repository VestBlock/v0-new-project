import type { SupabaseClient } from '@supabase/supabase-js';

export type SeedContentAsset = {
  slug: string;
  title: string;
  contentType: 'seo_page' | 'social_post';
  serviceKey: string;
  language: 'en' | 'es';
  audience: string;
  platform: string;
  postType: string;
  seoTitle?: string;
  metaDescription?: string;
  excerpt?: string;
  bodyMarkdown: string;
  socialCaption?: string;
  hashtags?: string[];
  ctaLabel: string;
  ctaUrl: string;
};

function seoPage(
  input: Omit<SeedContentAsset, 'contentType' | 'platform' | 'postType'>
): SeedContentAsset {
  return {
    ...input,
    contentType: 'seo_page',
    platform: 'manual',
    postType: 'landing page',
  };
}

function socialPost(
  input: Omit<SeedContentAsset, 'contentType' | 'seoTitle' | 'metaDescription' | 'excerpt'>
): SeedContentAsset {
  return {
    ...input,
    contentType: 'social_post',
  };
}

export const vestblockSeedContentAssets: SeedContentAsset[] = [
  seoPage({
    slug: 'business-funding-readiness-checklist',
    title: 'Business Funding Readiness Checklist For New And Growing Companies',
    serviceKey: 'business_funding',
    language: 'en',
    audience: 'business owners who want to know if they are ready to apply for funding',
    seoTitle: 'Business Funding Readiness Checklist | VestBlock',
    metaDescription:
      'Use this VestBlock checklist to prepare documents, credit, revenue answers, and banking before applying for business funding.',
    excerpt:
      'A practical checklist for business owners who want a cleaner funding application path before they talk to lenders or funding partners.',
    ctaLabel: 'Check Funding Eligibility',
    ctaUrl: '/funding',
    bodyMarkdown: `# Business Funding Readiness Checklist

Business funding gets easier to evaluate when the company profile is organized before the application starts. VestBlock helps you see whether you should apply now, prepare first, or improve parts of the file before creating more inquiry pressure.

## What lenders usually want to understand

- Who the business is and how it is structured
- How long the company has been operating
- Whether the business has a real banking relationship
- Whether revenue, expenses, and use of funds are clear
- Whether the owner profile shows manageable utilization and inquiry activity

## Core documents to gather before applying

1. Entity formation paperwork
2. EIN confirmation
3. Business bank account details
4. Recent bank statements
5. Basic revenue history
6. A short explanation of how the funds will be used
7. Updated contact details and business address

## Credit profile checks that matter

Even when the goal is business funding, personal credit can still affect the outcome. Review:

- Estimated FICO range
- Current utilization
- Recent inquiries
- Number of new accounts in the last 24 months
- Any major negative items that still need attention

If utilization is high or inquiries are already stacked up, the safer move may be to slow down and prepare before applying.

## Signs you may be ready now

- Your business records are organized
- You have an EIN and active business banking
- You can explain the funding goal clearly
- Utilization is under control
- Inquiry pressure is reasonable
- Revenue and business timeline are documentable

## Signs you should prepare first

- You are still mixing business and personal activity
- You do not have an EIN or business bank account yet
- Your utilization is too high
- You cannot clearly support the income or revenue story
- You are unsure which type of funding fits your situation

## A simple next-step checklist

- Confirm your business structure and EIN
- Review utilization before submitting applications
- Organize bank statements and business details
- Define the funding goal and amount range
- Use VestBlock to review the safest path before applying

## FAQ

### Does VestBlock guarantee approvals?
No. VestBlock helps with readiness, organization, and strategy. Approval decisions and terms are made by the issuer or lender.

### Can I apply if my business is new?
You may still have options, but a newer business often needs a tighter preparation review and realistic expectations.

### Why does utilization matter?
High utilization can reduce approvals, lower limits, and make a multi-step funding plan harder to execute cleanly.

### Should I apply before my paperwork is organized?
Usually no. A rushed application creates avoidable friction and can make the next application harder.

## Ready for the next step?

Use VestBlock to review your funding options and compare whether you should pursue business funding now or prepare the file first.
`,
  }),
  seoPage({
    slug: 'business-credit-building-starter-guide',
    title: 'Business Credit Building Starter Guide For VestBlock Users',
    serviceKey: 'business_credit',
    language: 'en',
    audience: 'business owners building lender-ready business credit foundations',
    seoTitle: 'Business Credit Building Starter Guide | VestBlock',
    metaDescription:
      'Learn how VestBlock approaches business credit setup, vendor readiness, monitoring, and credit-building next steps without hype.',
    excerpt:
      'A practical starting point for business owners who want cleaner business credit foundations before chasing larger funding goals.',
    ctaLabel: 'Open Business Credit Tool',
    ctaUrl: '/tools/business-credit',
    bodyMarkdown: `# Business Credit Building Starter Guide

Business credit is most useful when it supports a real operating company. VestBlock keeps this simple: build the file, organize the basics, and move in a way that does not create confusion between hype and reality.

## Start with the business identity

Before worrying about vendors or starter accounts, make sure the business itself is clean:

- The entity information is consistent
- The EIN is active
- The contact details are stable
- Banking is separated from personal activity
- The business has a real reason for building credit

## What business credit can help with

- Creating a more organized lender-facing profile
- Supporting vendor and financing relationships
- Giving you a clearer plan for future funding preparation

## What it does not do by itself

- It does not guarantee approvals
- It does not replace cash flow
- It does not mean personal credit never matters
- It does not make poor documentation disappear

## Common mistakes to avoid

1. Applying without a clean business profile
2. Using conflicting business details from one application to another
3. Treating every vendor account as if it automatically solves funding preparation
4. Ignoring personal utilization and inquiry pressure
5. Building accounts without a plan for what comes next

## VestBlock's recommended rhythm

- Set up the entity and banking correctly
- Review personal credit pressure
- Build the business profile deliberately
- Track the next useful accounts instead of chasing random offers
- Connect business credit work back to the funding goal

## FAQ

### Is business credit enough to qualify for funding?
Not always. Lenders may still review the owner profile, revenue, time in business, and use of funds.

### Can VestBlock tell me what to do first?
Yes. The business credit tool is meant to help organize the first steps and build a more realistic roadmap.

### Is this only for established businesses?
No. Early-stage companies can still benefit from getting the structure and documentation right early.

## Next step

If you want to build a stronger business profile before applying for funding, use the VestBlock business credit workflow and get a more practical roadmap.
`,
  }),
  seoPage({
    slug: 'grant-readiness-for-small-businesses',
    title: 'Grant Readiness For Small Businesses Before You Start Applying',
    serviceKey: 'grants',
    language: 'en',
    audience: 'small business owners preparing for grant searches and applications',
    seoTitle: 'Grant Readiness For Small Businesses | VestBlock',
    metaDescription:
      'Prepare for small business grants with a VestBlock checklist focused on eligibility, documents, deadlines, and stronger applications.',
    excerpt:
      'A simple guide for business owners who want to approach grant opportunities with better documents, better fit, and less wasted effort.',
    ctaLabel: 'Open Grants Tool',
    ctaUrl: '/tools/grants',
    bodyMarkdown: `# Grant Readiness For Small Businesses

Grant searches become much more useful when the business is organized before you start applying. VestBlock helps you focus on fit, documents, and application quality instead of chasing every opportunity that looks promising.

## What to review before you apply

- Eligibility requirements
- Industry fit
- Location fit
- Revenue or founder requirements
- Required narratives, budgets, or support documents

## Documents worth preparing early

1. Business summary
2. EIN and entity information
3. Clear founder and company story
4. Revenue or operating context if required
5. Explanation of how grant funds would be used
6. Basic timeline for the project or growth plan

## Why readiness matters

Many business owners waste time on grants that are not a real fit. A readiness-first approach helps you:

- Filter out weak opportunities faster
- Submit cleaner applications
- Avoid missing simple requirements
- Keep your message consistent across programs

## Stronger grant positioning

The best applications usually make it easy to understand:

- what the business does
- why funding is needed
- how the money will be used
- what outcome the company is working toward

## Avoid these mistakes

- Treating grants like guaranteed free money
- Applying without reading eligibility rules
- Sending the same weak narrative everywhere
- Ignoring deadlines and support documents
- Using vague or unsupported funding requests

## FAQ

### Does VestBlock guarantee a grant award?
No. VestBlock helps with organization, matching, and draft support. Award decisions are made by the grant program.

### Should I apply to every grant I find?
No. Fit matters more than volume.

### Can VestBlock help me write a stronger application?
It can help organize your message, supporting details, and next steps before you submit.

## Next step

Use the VestBlock grants tool to review opportunities that better match your business profile and prepare cleaner application materials.
`,
  }),
  seoPage({
    slug: 'real-estate-funding-readiness-guide',
    title: 'Real Estate Funding Readiness Guide For Investors And Property Owners',
    serviceKey: 'real_estate_funding',
    language: 'en',
    audience: 'investors and property owners preparing for real estate funding conversations',
    seoTitle: 'Real Estate Funding Readiness Guide | VestBlock',
    metaDescription:
      'Get ready for real estate funding conversations with a VestBlock guide covering deal details, documents, timelines, and lender expectations.',
    excerpt:
      'A practical real estate funding prep guide for owners and investors who want cleaner deal intake and better follow-up.',
    ctaLabel: 'Open Real Estate Funding Form',
    ctaUrl: '/real-estate-funding',
    bodyMarkdown: `# Real Estate Funding Readiness Guide

Real estate funding conversations move faster when the basic deal picture is already organized. VestBlock uses intake structure to help you gather the details that matter before follow-up starts.

## Information worth organizing first

- Property type
- Location
- Purchase or refinance context
- Estimated funding need
- Timeline
- Exit plan or use-case

## Why this helps

Cleaner intake makes it easier to:

- route the lead correctly
- ask sharper follow-up questions
- avoid vague conversations that go nowhere

## Questions you should be ready to answer

1. What is the deal?
2. What is the property being used for?
3. How much capital is needed?
4. What is the timing?
5. What documents can you provide?

## Common reasons deals stall

- Missing numbers
- No clear use of funds
- No supporting context
- Unrealistic timing
- Incomplete property information

## FAQ

### Does VestBlock provide underwriting decisions?
No. VestBlock helps collect and organize deal information before funding follow-up.

### Can this help owner-occupants and investors?
Yes, as long as the property details and funding need are explained clearly.

## Next step

Use the VestBlock real estate funding intake so the next conversation starts with better information.
`,
  }),
  seoPage({
    slug: 'business-funding-strategy-working-capital-guide',
    title: 'Business Funding Strategy Guide For Working Capital Readiness',
    serviceKey: 'credit_card_stacking',
    language: 'en',
    audience: 'business owners exploring a multi-account working capital strategy',
    seoTitle: 'Business Funding Strategy Guide | VestBlock',
    metaDescription:
      'Review working-capital readiness, inquiry pressure, utilization, documentation, and consent before pursuing a business funding strategy.',
    excerpt:
      'A compliance-safe guide to preparing for a business funding strategy without overpromising outcomes or pretending every business should apply now.',
    ctaLabel: 'Review Funding Strategy',
    ctaUrl: '/funding/business-funding-strategy',
    bodyMarkdown: `# Business Funding Strategy Guide

Some business owners want working capital options built around multiple business credit accounts. VestBlock treats that as a readiness and sequencing problem, not a magic trick.

## What should be reviewed first

- Current utilization
- Recent inquiries
- Business formation and EIN status
- Banking and revenue support
- Repayment ability
- Clear use of funds

## Why sequencing matters

A business funding strategy can go sideways when applications are rushed, documentation is weak, or the business is not ready for the level of scrutiny involved.

## When preparation may be smarter than applying now

- Utilization is high
- Inquiry count is already heavy
- Business paperwork is incomplete
- Banking is not established
- Revenue or use-of-funds explanations are weak

## When a strategy review may make sense

- The company has an EIN and business banking
- The owner profile is more stable
- The funding goal is clear
- The business can support truthful, documentable answers
- The owner understands hard-inquiry and repayment risk

## Important compliance note

VestBlock does not support fake income, fake revenue, or fake business details. The strategy only works long-term when the file is truthful and supportable.

## FAQ

### Does VestBlock guarantee approvals or limits?
No. Issuer decisions, limits, APRs, and terms vary.

### Is this the right path for every business?
No. Some businesses should prepare first, repair first, or use a different funding path.

### Why does VestBlock ask for consent?
Because inquiry risk, utilization pressure, and repayment obligations should be understood before moving forward.

## Next step

Use the VestBlock business funding strategy workflow to see whether you should apply now, prepare first, or build a stronger file before creating more pressure.
`,
  }),
  seoPage({
    slug: 'financiamiento-para-negocios-requisitos-clave',
    title: 'Financiamiento Para Negocios: Requisitos Clave Antes De Aplicar',
    serviceKey: 'spanish_business_funding',
    language: 'es',
    audience: 'duenos de negocio que hablan espanol y quieren prepararse antes de buscar financiamiento',
    seoTitle: 'Financiamiento Para Negocios En Espanol | VestBlock',
    metaDescription:
      'Aprende que documentos, credito, cuenta bancaria y pasos de preparacion ayudan antes de buscar financiamiento para negocios.',
    excerpt:
      'Una guia en espanol para ayudar a duenos de negocio a prepararse mejor antes de revisar opciones de financiamiento.',
    ctaLabel: 'Abrir Ruta De Financiamiento',
    ctaUrl: '/es/vestblock',
    bodyMarkdown: `# Financiamiento Para Negocios: Requisitos Clave

Antes de aplicar para financiamiento, conviene organizar el perfil del negocio y los documentos basicos. VestBlock ayuda a duenos de negocio a revisar si estan listos ahora o si primero deben preparar mejor su empresa.

## Que suele importar antes de aplicar

- EIN activo
- cuenta bancaria comercial
- informacion consistente del negocio
- explicacion clara del uso de fondos
- contexto real sobre ingresos y operacion
- perfil de credito con menos presion

## Documentos utiles para preparar

1. documentos de formacion del negocio
2. confirmacion del EIN
3. estados bancarios recientes
4. informacion de ingresos
5. descripcion de como se van a usar los fondos

## Senales de que debes prepararte primero

- no tienes EIN o banca comercial
- la utilizacion esta muy alta
- hay demasiadas consultas recientes
- no puedes documentar bien la historia del negocio

## Senales de que puedes revisar opciones

- la informacion del negocio esta organizada
- puedes explicar el uso de fondos con claridad
- tu perfil luce mas estable
- sabes que toda respuesta debe ser veridica y documentable

## Preguntas frecuentes

### VestBlock garantiza financiamiento?
No. VestBlock ofrece herramientas de educacion, organizacion y estrategia. Las decisiones las toma el banco, emisor o socio de financiamiento.

### Puedo aplicar si mi negocio es nuevo?
Tal vez, pero un negocio nuevo normalmente necesita una revision mas cuidadosa de documentos, credito y expectativas.

### Por que importa la utilizacion?
Porque una utilizacion alta puede afectar aprobaciones, limites y terminos.

## Proximo paso

Abre la ruta de VestBlock en espanol para revisar preparacion, documentos y opciones con una base mas clara.
`,
  }),
  socialPost({
    slug: 'business-funding-documents-instagram-post',
    title: 'Business Funding Documents Checklist Social Post',
    serviceKey: 'business_funding',
    language: 'en',
    audience: 'small business owners getting ready for funding',
    platform: 'instagram',
    postType: 'educational',
    ctaLabel: 'Check Funding Eligibility',
    ctaUrl: '/funding',
    hashtags: ['#businessfunding', '#smallbusiness', '#workingcapital', '#fundingreadiness'],
    socialCaption:
      'Before you apply for business funding, clean up the file first. EIN, business banking, clear use of funds, and realistic credit expectations can save you from rushed applications and extra inquiry pressure. VestBlock helps you figure out whether to apply now or prepare first.',
    bodyMarkdown:
      'Hook: Before you chase funding, get the file ready.\n\nKey points:\n- EIN and banking matter\n- utilization and inquiries matter\n- a clear use-of-funds story matters\n\nCTA: Use VestBlock to check your funding options before you apply.',
  }),
  socialPost({
    slug: 'business-credit-mistakes-linkedin-post',
    title: 'Business Credit Mistakes LinkedIn Post',
    serviceKey: 'business_credit',
    language: 'en',
    audience: 'owners building business credit for future funding',
    platform: 'linkedin',
    postType: 'thought leadership',
    ctaLabel: 'Open Business Credit Tool',
    ctaUrl: '/tools/business-credit',
    hashtags: ['#businesscredit', '#fundingstrategy', '#smallbusinessgrowth', '#creditreadiness'],
    socialCaption:
      'A lot of business owners start building business credit without a real sequence. The basics still matter: entity consistency, banking, documentation, and understanding where personal credit still shows up. VestBlock is built to make that process more practical.',
    bodyMarkdown:
      'Hook: Building business credit without a roadmap usually creates noise.\n\nPost angle:\n- clean entity details\n- separate banking\n- realistic expectations\n- funding goals tied to the profile\n\nCTA: Open the VestBlock business credit tool for a more practical roadmap.',
  }),
  socialPost({
    slug: 'financiamiento-en-espanol-post',
    title: 'Financiamiento En Espanol Social Post',
    serviceKey: 'spanish_business_funding',
    language: 'es',
    audience: 'duenos de negocio que hablan espanol',
    platform: 'facebook',
    postType: 'educational',
    ctaLabel: 'Abrir Ruta De Financiamiento',
    ctaUrl: '/es/vestblock',
    hashtags: ['#negocios', '#financiamiento', '#creditoempresarial', '#vestblock'],
    socialCaption:
      'Antes de buscar financiamiento, prepara bien tu negocio. EIN, banca comercial, documentos claros y una razon real para usar los fondos pueden cambiar la calidad de la conversacion. VestBlock ya tiene una ruta en espanol para ayudarte a empezar mejor.',
    bodyMarkdown:
      'Hook: Primero prepara el negocio, luego busca opciones.\n\nPuntos:\n- EIN y cuenta bancaria\n- documentos organizados\n- credito y uso de fondos claros\n\nCTA: Abre la ruta de VestBlock en espanol.',
  }),
];

type SupabaseLike = SupabaseClient<any, 'public', any>;

export async function seedVestblockContentAssets(input: {
  supabase: SupabaseLike;
  actorUserId?: string | null;
  publish?: boolean;
  overwrite?: boolean;
  slugs?: string[];
}) {
  const selectedAssets = input.slugs?.length
    ? vestblockSeedContentAssets.filter((asset) => input.slugs?.includes(asset.slug))
    : vestblockSeedContentAssets;

  const status = input.publish === false ? 'draft' : 'published';
  const now = new Date().toISOString();
  let assetsToPersist = selectedAssets;

  if (input.overwrite === false && selectedAssets.length > 0) {
    const { data: existingAssets, error: existingError } = await input.supabase
      .from('content_assets')
      .select('slug')
      .in(
        'slug',
        selectedAssets.map((asset) => asset.slug)
      );

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingSlugs = new Set(
      (existingAssets || []).map((asset: { slug: string }) => asset.slug)
    );
    assetsToPersist = selectedAssets.filter((asset) => !existingSlugs.has(asset.slug));
  }

  const payload = assetsToPersist.map((asset) => ({
    created_by: input.actorUserId ?? null,
    title: asset.title,
    slug: asset.slug,
    content_type: asset.contentType,
    service_key: asset.serviceKey,
    language: asset.language,
    audience: asset.audience,
    prompt: 'Seeded by VestBlock batch content automation.',
    status,
    platform: asset.platform,
    post_type: asset.postType,
    seo_title: asset.seoTitle ?? null,
    meta_description: asset.metaDescription ?? null,
    excerpt: asset.excerpt ?? null,
    body_markdown: asset.bodyMarkdown,
    social_caption: asset.socialCaption ?? null,
    hashtags: asset.hashtags ?? [],
    cta_label: asset.ctaLabel,
    cta_url: asset.ctaUrl,
    publish_path: asset.contentType === 'seo_page' ? `/resources/${asset.slug}` : null,
    metadata_json: {
      generatedBy: 'seed-batch',
      seededAt: now,
      source: 'vestblock-launch-content',
    },
    created_at: now,
    updated_at: now,
    published_at: status === 'published' ? now : null,
  }));

  if (payload.length === 0) {
    return [];
  }

  const { data, error } = await input.supabase
    .from('content_assets')
    .upsert(payload, { onConflict: 'slug' })
    .select('*');

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
