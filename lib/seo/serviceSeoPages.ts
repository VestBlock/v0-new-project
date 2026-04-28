export type ServiceSeoSection = {
  heading: string;
  body: string;
  bullets?: string[];
};

export type ServiceSeoFaq = {
  question: string;
  answer: string;
};

export type ServiceSeoPage = {
  serviceKey: string;
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  excerpt: string;
  audience: string;
  primaryRoute: string;
  primaryCta: string;
  secondaryRoute?: string;
  secondaryCta?: string;
  sections: ServiceSeoSection[];
  faqs: ServiceSeoFaq[];
  relatedSlugs: string[];
};

export const serviceSeoPages: ServiceSeoPage[] = [
  {
    serviceKey: 'credit_analysis',
    slug: 'ai-credit-analysis',
    title: 'AI Credit Analysis For Credit Repair Planning',
    seoTitle: 'AI Credit Analysis For Credit Repair And Dispute Planning',
    metaDescription:
      'Use VestBlock AI credit analysis to organize credit report issues, understand dispute opportunities, and prepare next steps without score guarantees.',
    excerpt:
      'VestBlock helps users turn a confusing credit report into organized findings, next steps, and dispute-letter support they can review.',
    audience:
      'Consumers who need to understand negative items, report errors, dispute options, and credit repair next steps.',
    primaryRoute: '/credit-upload',
    primaryCta: 'Upload A Credit Report',
    secondaryRoute: '/learn/ai-credit-repair',
    secondaryCta: 'Read The AI Credit Repair Guide',
    sections: [
      {
        heading: 'What this service does',
        body:
          'AI Credit Analysis reviews uploaded credit report text and organizes the information into practical credit repair categories. The goal is clarity: which items may need documentation, which accounts may require dispute review, and which next steps make sense before letters are generated.',
        bullets: [
          'Organizes negative items and account details',
          'Helps identify dispute-letter starting points',
          'Connects report status to admin review and email alerts',
          'Keeps the user in control of what they review and send',
        ],
      },
      {
        heading: 'When it is useful',
        body:
          'This service is best when a user has a recent credit report but does not know what is damaging the file or which items may be inaccurate, outdated, duplicated, mixed, or missing context.',
      },
      {
        heading: 'How VestBlock keeps it compliant',
        body:
          'VestBlock does not promise score increases or deletion of accurate information. The service is framed around education, report organization, documentation, and user-reviewed dispute actions.',
      },
    ],
    faqs: [
      {
        question: 'Does AI credit analysis repair my credit automatically?',
        answer:
          'No. It organizes report information and helps prepare next steps. Users still review the findings, decide what to dispute, and control any letters or follow-up actions.',
      },
      {
        question: 'Can VestBlock guarantee that negative items will be removed?',
        answer:
          'No. Accurate negative information may remain. VestBlock focuses on accuracy, documentation, and dispute rights instead of guaranteed deletion claims.',
      },
      {
        question: 'What should I upload?',
        answer:
          'A recent credit report PDF or supported document gives the best starting point. Users should avoid uploading unrelated sensitive documents.',
      },
    ],
    relatedSlugs: ['credit-dispute-letters', 'debt-utilization-planning'],
  },
  {
    serviceKey: 'business_funding',
    slug: 'business-funding-eligibility',
    title: 'Business Funding Eligibility And Readiness',
    seoTitle: 'Business Funding Eligibility Checker And Readiness Plan',
    metaDescription:
      'Check business funding readiness for free, then use VestBlock prep services if documents, revenue, credit, or business structure need work first.',
    excerpt:
      'VestBlock helps business owners understand whether they should apply now, prepare first, or review a more structured funding strategy.',
    audience:
      'Business owners comparing funding options, readiness gaps, documents, credit profile, and use-of-funds requirements.',
    primaryRoute: '/funding#free-eligibility-check',
    primaryCta: 'Check Funding Eligibility Free',
    secondaryRoute: '/funding/business-funding-strategy',
    secondaryCta: 'Review Funding Strategy',
    sections: [
      {
        heading: 'Start with a free readiness check',
        body:
          'The free funding checker helps a business owner compare basic readiness factors before applying. It looks at the kind of details lenders and funding partners often care about, such as business stage, revenue, credit profile, documentation, and intended use of funds.',
        bullets: [
          'Business profile and entity basics',
          'Revenue and banking readiness',
          'Personal credit and utilization considerations',
          'Funding amount and use-of-funds clarity',
        ],
      },
      {
        heading: 'When paid help makes sense',
        body:
          'Some owners are not ready to apply right away. VestBlock can route them into paid readiness support when the business needs cleaner records, better documents, lower risk factors, or a more realistic funding path before applications.',
      },
      {
        heading: 'What VestBlock does not promise',
        body:
          'VestBlock does not guarantee approvals, terms, limits, rates, or funding timelines. The platform helps prepare and route the next step so owners can make better decisions before they apply.',
      },
    ],
    faqs: [
      {
        question: 'Is the business funding eligibility check free?',
        answer:
          'Yes. The initial readiness check is free. If the business needs preparation before applying, VestBlock may recommend a paid readiness plan.',
      },
      {
        question: 'What if my business is not eligible yet?',
        answer:
          'The next step is usually preparation: organize documents, clarify revenue, review credit factors, and avoid applying too early.',
      },
      {
        question: 'Does VestBlock fund the business directly?',
        answer:
          'VestBlock helps with readiness, routing, and follow-up. Actual funding depends on partners, lenders, underwriting, terms, and user decisions.',
      },
    ],
    relatedSlugs: ['business-funding-strategy', 'business-setup-funding-grants'],
  },
  {
    serviceKey: 'credit_card_stacking',
    slug: 'business-funding-strategy',
    title: 'Business Funding Strategy Readiness',
    seoTitle: 'Business Funding Strategy And Credit Line Readiness',
    metaDescription:
      'Prepare for business credit funding with VestBlock readiness review, document checks, inquiry-risk consent, utilization guidance, and admin follow-up.',
    excerpt:
      'VestBlock helps business owners understand the risk, readiness, documents, and repayment considerations before pursuing a business credit funding sequence.',
    audience:
      'Business owners considering business credit lines or business credit line working-capital options.',
    primaryRoute: '/funding/business-funding-strategy',
    primaryCta: 'Start The Funding Strategy Review',
    secondaryRoute: '/funding#free-eligibility-check',
    secondaryCta: 'Check Eligibility First',
    sections: [
      {
        heading: 'What business funding strategy preparation means',
        body:
          'A business credit line funding strategy usually means reviewing multiple business credit options in a planned sequence. Because that can involve hard inquiries, utilization risk, fees, and repayment pressure, VestBlock treats it as a readiness and consent workflow, not an instant approval promise.',
        bullets: [
          'Review business and personal credit readiness',
          'Check business documents and banking basics',
          'Explain hard-inquiry and repayment considerations',
          'Capture success-fee consent only where applicable',
        ],
      },
      {
        heading: 'How the VestBlock offer is priced',
        body:
          'The current strategy path uses a $300 readiness plan plus a 10% success fee only after accepted business credit funding is available. This keeps the paid setup separate from any final lender or issuer decision.',
      },
      {
        heading: 'What owners should know before applying',
        body:
          'Applying too early can create avoidable inquiries or debt pressure. A better process checks documents, scores, balances, revenue, repayment plan, and current business need before a sequence begins.',
      },
    ],
    faqs: [
      {
        question: 'Does this strategy guarantee business funding?',
        answer:
          'No. Card approvals, limits, terms, and fees depend on issuers, underwriting, credit profile, income, business details, and user decisions.',
      },
      {
        question: 'Why charge a readiness fee?',
        answer:
          'The readiness fee covers review, organization, risk checks, and preparation before a strategy is pursued. It is not a guarantee of approval.',
      },
      {
        question: 'When does the success fee apply?',
        answer:
          'The success-fee language is tied to accepted and available business credit funding, not to a simple application or inquiry.',
      },
    ],
    relatedSlugs: ['business-funding-eligibility', 'debt-utilization-planning'],
  },
  {
    serviceKey: 'business_setup',
    slug: 'business-setup-funding-grants',
    title: 'Business Setup For Funding And Grants',
    seoTitle: 'Business Setup For Funding, Grants, And Business Credit',
    metaDescription:
      'Prepare entity records, EIN, business banking, documents, business credit basics, and use-of-funds details before funding or grant applications.',
    excerpt:
      'VestBlock helps owners organize the business foundations that often matter before applying for funding, grants, or business credit.',
    audience:
      'New and growing business owners who need structure before they pursue funding, grants, or business credit.',
    primaryRoute: '/business-setup',
    primaryCta: 'Prepare My Business',
    secondaryRoute: '/tools/business-credit',
    secondaryCta: 'Build Business Credit',
    sections: [
      {
        heading: 'Why setup matters before applications',
        body:
          'Many funding and grant problems start before the application. Missing records, unclear use of funds, weak banking history, or inconsistent business identity can slow down reviews or create avoidable denials.',
        bullets: [
          'Entity and EIN basics',
          'Business bank account readiness',
          'Revenue and document organization',
          'Business credit and monitoring next steps',
        ],
      },
      {
        heading: 'What VestBlock helps organize',
        body:
          'The setup flow helps owners think through the records, documents, business identity, and credit preparation that support stronger funding and grant conversations.',
      },
      {
        heading: 'The safe way to frame the service',
        body:
          'Business setup is preparation support. It is not legal, tax, accounting, grant-award, or lender-approval advice.',
      },
    ],
    faqs: [
      {
        question: 'Do I need an EIN before business funding?',
        answer:
          'Many business funding paths expect a clear business identity, and an EIN is often part of that setup. Requirements still vary by product, lender, and program.',
      },
      {
        question: 'Can setup help with grants too?',
        answer:
          'Yes. Grant applications often require clear documents, business details, use-of-funds language, and proof that the business fits the program.',
      },
      {
        question: 'Is this legal or tax advice?',
        answer:
          'No. VestBlock provides readiness guidance and organization. Owners should use qualified professionals for legal, tax, or accounting decisions.',
      },
    ],
    relatedSlugs: ['business-funding-eligibility', 'small-business-grants'],
  },
  {
    serviceKey: 'financial_growth_services',
    slug: 'financial-growth-services',
    title: 'Financial Growth Services For Credit, Funding, Grants, And Deals',
    seoTitle: 'Financial Growth Services For Funding Readiness And Credit Planning',
    metaDescription:
      'Review VestBlock paid financial prep packages for funding readiness, business credit, grants, utilization, cash-flow documents, and real estate funding.',
    excerpt:
      'VestBlock offers paid preparation packages for clients who need more than a free checker before they apply, dispute, or submit a deal.',
    audience:
      'Clients who need a practical paid review before funding, grants, credit repair, business credit, or real estate funding steps.',
    primaryRoute: '/services/financial-growth',
    primaryCta: 'View Financial Packages',
    secondaryRoute: '/services/financial-growth#request-service',
    secondaryCta: 'Request A Service',
    sections: [
      {
        heading: 'What these packages are for',
        body:
          'Financial Growth Services turn broad goals into clear, paid preparation work. Each package has a defined scope, price, and follow-up path so clients know what they are buying before deeper funding or credit work begins.',
        bullets: [
          'Funding Readiness Snapshot',
          'Business Credit Builder Sprint',
          'Grant Application Prep Review',
          'Debt And Utilization Paydown Plan',
          'Cash Flow And Bank Statement Review',
          'Real Estate Deal Funding Review',
        ],
      },
      {
        heading: 'How this helps VestBlock operations',
        body:
          'Each request creates a real lead with the selected package, price, business details, user goal, and admin follow-up context. That makes the service easier to sell, track, and fulfill.',
      },
      {
        heading: 'What is not included',
        body:
          'These packages do not guarantee approvals, awards, credit score outcomes, or lender terms. They are preparation and review services.',
      },
    ],
    faqs: [
      {
        question: 'Which financial growth package should I choose?',
        answer:
          'Start with the package closest to the immediate goal: funding readiness, business credit, grants, debt utilization, cash-flow documents, or real estate deal review.',
      },
      {
        question: 'Are these one-time packages?',
        answer:
          'Yes. The current offer is structured as one-time preparation packages, with deeper funding support available where appropriate.',
      },
      {
        question: 'Can this replace a lender, CPA, attorney, or financial advisor?',
        answer:
          'No. VestBlock helps with readiness and organization. Specialized legal, tax, accounting, investment, or underwriting advice should come from qualified professionals.',
      },
    ],
    relatedSlugs: ['business-funding-eligibility', 'real-estate-funding'],
  },
  {
    serviceKey: 'grants',
    slug: 'small-business-grants',
    title: 'Small Business Grants And Application Prep',
    seoTitle: 'Small Business Grant Finder And Application Prep',
    metaDescription:
      'Use VestBlock to review grant readiness, match business details to opportunities, and draft stronger application language for manual review.',
    excerpt:
      'VestBlock helps business owners organize grant-fit details, deadlines, documents, and application language without promising awards.',
    audience:
      'Small business owners searching for grant opportunities and clearer application preparation.',
    primaryRoute: '/tools/grants',
    primaryCta: 'Find Grant Matches',
    secondaryRoute: '/business-setup',
    secondaryCta: 'Check Grant Readiness',
    sections: [
      {
        heading: 'What grant readiness means',
        body:
          'Grant readiness is not just finding a list of programs. Owners need to understand eligibility, deadlines, requested documents, business purpose, budget, and how the opportunity connects to their real use of funds.',
        bullets: [
          'Business profile and industry fit',
          'Required documents and deadlines',
          'Use-of-funds explanation',
          'Application letter draft for review',
        ],
      },
      {
        heading: 'How VestBlock helps',
        body:
          'VestBlock can match a business profile to grant opportunities and help draft clearer application language. The owner still reviews program rules and submits only when the opportunity fits.',
      },
      {
        heading: 'Avoiding bad grant promises',
        body:
          'Grant content should never sound like free money for everyone. VestBlock keeps the focus on eligibility, documentation, deadlines, and user-controlled applications.',
      },
    ],
    faqs: [
      {
        question: 'Does VestBlock guarantee grant awards?',
        answer:
          'No. Grant awards depend on program rules, eligibility, deadlines, available funds, review committees, and the strength of the application.',
      },
      {
        question: 'Can a startup apply for grants?',
        answer:
          'Some grants are open to early-stage businesses, but many require specific industries, locations, ownership categories, revenue details, or use-of-funds requirements.',
      },
      {
        question: 'What makes a grant application stronger?',
        answer:
          'Clear eligibility fit, strong documentation, specific use of funds, realistic outcomes, and complete answers usually matter more than generic language.',
      },
    ],
    relatedSlugs: ['business-setup-funding-grants', 'business-funding-eligibility'],
  },
  {
    serviceKey: 'spanish_funding',
    slug: 'spanish-business-funding',
    title: 'Financiamiento Para Negocios En Espanol',
    seoTitle: 'Financiamiento Para Negocios En Espanol Con VestBlock',
    metaDescription:
      'VestBlock ayuda a duenos de negocio que hablan espanol a preparar documentos, credito comercial y pasos de financiamiento antes de revisar opciones.',
    excerpt:
      'Una ruta clara en espanol para duenos de negocio que quieren prepararse antes de solicitar financiamiento.',
    audience:
      'Duenos de negocio que hablan espanol y necesitan una guia clara antes de buscar financiamiento.',
    primaryRoute: '/es/vestblock',
    primaryCta: 'Ver Opciones En Espanol',
    secondaryRoute: 'https://Bankbreezy.com/es/Vestblock',
    secondaryCta: 'Revisar Bank Breezy',
    sections: [
      {
        heading: 'Para quien es esta pagina',
        body:
          'Esta ruta es para duenos de negocio que quieren entender que preparar antes de revisar opciones de financiamiento. El enfoque esta en documentos, credito, banco comercial, ingresos, uso de fondos y siguientes pasos.',
        bullets: [
          'Preparacion de documentos del negocio',
          'Credito personal y comercial',
          'Cuenta bancaria comercial',
          'Uso claro de los fondos',
        ],
      },
      {
        heading: 'Como VestBlock ayuda',
        body:
          'VestBlock organiza la preparacion y conecta al dueno con paginas, herramientas y rutas de seguimiento. Cuando sea apropiado, tambien se puede revisar la opcion en espanol de Bank Breezy.',
      },
      {
        heading: 'Sin promesas falsas',
        body:
          'VestBlock no garantiza aprobacion, cantidad de financiamiento, terminos, tasas ni tiempo de respuesta. Cada decision depende del perfil, documentos, reglas del proveedor y revision final.',
      },
    ],
    faqs: [
      {
        question: 'VestBlock garantiza financiamiento?',
        answer:
          'No. VestBlock ayuda con preparacion, organizacion y siguientes pasos. La aprobacion depende del proveedor, documentos, credito, ingresos y terminos.',
      },
      {
        question: 'Que debo preparar antes de solicitar?',
        answer:
          'Identidad del negocio, EIN si aplica, cuenta bancaria comercial, ingresos, documentos, credito, uso de fondos y datos de contacto actualizados.',
      },
      {
        question: 'Bank Breezy es parte de VestBlock?',
        answer:
          'Bank Breezy es una ruta de socio que los usuarios pueden revisar. VestBlock mantiene la preparacion y el seguimiento separados de cualquier decision externa.',
      },
    ],
    relatedSlugs: ['business-funding-eligibility', 'business-setup-funding-grants'],
  },
  {
    serviceKey: 'real_estate_funding',
    slug: 'real-estate-funding',
    title: 'Real Estate Funding Review For Investors And Property Deals',
    seoTitle: 'Real Estate Funding Review For DSCR, Rental, Flip, And Deal Prep',
    metaDescription:
      'Submit DSCR, rental, fix-and-flip, hard-money, or deal funding details so VestBlock can review the opportunity and route follow-up.',
    excerpt:
      'VestBlock collects deal details so real estate funding requests can be reviewed and routed with more context.',
    audience:
      'Investors and property owners who need funding review for a rental, DSCR, fix-and-flip, hard-money, or property deal.',
    primaryRoute: '/real-estate-funding',
    primaryCta: 'Submit Funding Deal',
    secondaryRoute: '/services/financial-growth',
    secondaryCta: 'Review Deal Prep Services',
    sections: [
      {
        heading: 'What real estate funding review collects',
        body:
          'A real estate funding conversation needs more than a name and phone number. VestBlock collects deal type, property details, requested amount, liquidity, entity readiness, DSCR or rental context, contractor readiness, and notes that help route the opportunity.',
        bullets: [
          'DSCR and rental deal context',
          'Fix-and-flip or hard-money details',
          'Requested amount and use of funds',
          'Borrowing entity and document readiness',
        ],
      },
      {
        heading: 'Why the form matters',
        body:
          'Better intake makes follow-up more useful. It helps the team see whether the request is about a live deal, a future purchase, a refinance, a renovation, or a property owner exploring options.',
      },
      {
        heading: 'What is not promised',
        body:
          'Submitting a deal does not mean financing is approved. Final outcomes depend on property review, borrower profile, documents, underwriting, partner terms, and market conditions.',
      },
    ],
    faqs: [
      {
        question: 'What types of real estate funding can I submit?',
        answer:
          'VestBlock can collect context for DSCR, rental, fix-and-flip, hard-money, refinance, and other deal-review conversations.',
      },
      {
        question: 'Do I need a property under contract?',
        answer:
          'A contract can help, especially for time-sensitive deals, but the form can also capture planning-stage funding requests.',
      },
      {
        question: 'Does VestBlock guarantee financing?',
        answer:
          'No. VestBlock captures and routes the opportunity. Financing depends on review, underwriting, lender or partner requirements, and borrower decisions.',
      },
    ],
    relatedSlugs: ['financial-growth-services', 'sell-property'],
  },
  {
    serviceKey: 'sell_property',
    slug: 'sell-property',
    title: 'Sell Property Lead Review',
    seoTitle: 'Sell Property Lead Review For Owners Considering Investor Offers',
    metaDescription:
      'Use VestBlock to submit property details for seller follow-up, investor review, or a fast-sale conversation without a promised offer.',
    excerpt:
      'VestBlock helps property owners submit the details needed for a clearer investor or buyer follow-up conversation.',
    audience:
      'Property owners who want an investor conversation, cash-offer review, or fast-sale path.',
    primaryRoute: '/sell',
    primaryCta: 'Request Property Review',
    secondaryRoute: '/real-estate-funding',
    secondaryCta: 'Review Real Estate Funding',
    sections: [
      {
        heading: 'What sellers can submit',
        body:
          'The sell-property flow collects property address, property type, condition, occupancy, estimated value, desired price, liens or taxes, timeline, and contact preferences. That gives the follow-up team a better starting point.',
        bullets: [
          'Property and occupancy details',
          'Condition and repair context',
          'Estimated value and desired sale price',
          'Best time and method for follow-up',
        ],
      },
      {
        heading: 'When this path fits',
        body:
          'This path is useful when an owner wants a fast conversation, has an as-is property, is comparing investor interest, or wants to understand whether a sale path makes sense.',
      },
      {
        heading: 'Keeping expectations clear',
        body:
          'VestBlock does not promise a specific offer before review. Any offer, timeline, closing, or buyer conversation depends on the property, market, title, condition, and buyer interest.',
      },
    ],
    faqs: [
      {
        question: 'Will I get a guaranteed cash offer?',
        answer:
          'No. Submitting the form starts a review and follow-up process. Any offer depends on the property and buyer review.',
      },
      {
        question: 'Can I submit an as-is property?',
        answer:
          'Yes. The form is built to capture condition, repair notes, occupancy, and seller timeline so the review starts with useful context.',
      },
      {
        question: 'Is there an upfront fee?',
        answer:
          'The current property lead form does not collect an upfront fee.',
      },
    ],
    relatedSlugs: ['real-estate-funding', 'financial-growth-services'],
  },
  {
    serviceKey: 'ai_assistant',
    slug: 'vestblock-ai-assistant',
    title: 'VestBlock AI Assistant For Credit, Funding, And Service Routing',
    seoTitle: 'VestBlock AI Assistant For Credit Repair And Funding Questions',
    metaDescription:
      'Use the VestBlock AI Assistant to get routed toward credit repair, funding readiness, business credit, grants, real estate, or support workflows.',
    excerpt:
      'The AI Assistant helps users decide which VestBlock tool or service path fits their situation.',
    audience:
      'Visitors who need help choosing between credit repair, funding, grants, business credit, property, and support options.',
    primaryRoute: '/ai-assistant',
    primaryCta: 'Ask The Assistant',
    secondaryRoute: '/services',
    secondaryCta: 'Compare Services',
    sections: [
      {
        heading: 'What the assistant is for',
        body:
          'VestBlock has several paths, and not every visitor knows where to start. The AI Assistant helps route questions toward the right public page, tool, or lead workflow.',
        bullets: [
          'Credit report upload questions',
          'Funding readiness questions',
          'Business credit and grant direction',
          'Real estate funding or seller routing',
        ],
      },
      {
        heading: 'How it should be used',
        body:
          'The assistant is a guide, not a substitute for legal, tax, financial, underwriting, or credit reporting decisions. It should point users toward documented VestBlock workflows.',
      },
      {
        heading: 'Why this helps service conversion',
        body:
          'Good routing reduces confusion. Users can move faster from a question to the right action: upload a report, check funding, prepare a business, review grants, submit a property, or request a paid service.',
      },
    ],
    faqs: [
      {
        question: 'Can the AI Assistant tell me what service to use?',
        answer:
          'It can help route you based on your goal, but you should still review the service page and decide which action fits your situation.',
      },
      {
        question: 'Can it guarantee credit or funding results?',
        answer:
          'No. It should provide guidance and routing only, with no guarantees around scores, funding, approvals, grants, or property outcomes.',
      },
      {
        question: 'What if I already know what I need?',
        answer:
          'Use the service directory to go directly to credit upload, funding, business setup, grants, real estate funding, or property review.',
      },
    ],
    relatedSlugs: ['business-funding-eligibility', 'ai-credit-analysis'],
  },
];

export function getServiceSeoPage(slug: string) {
  return serviceSeoPages.find((page) => page.slug === slug);
}

export function getServiceSeoPageByServiceKey(serviceKey: string) {
  return serviceSeoPages.find((page) => page.serviceKey === serviceKey);
}
