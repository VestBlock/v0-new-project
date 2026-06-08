import { pricedVestBlockOffers } from '@/lib/services/pricedOffers';

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
  priceLabel?: string;
};

const baseServiceSeoPages: ServiceSeoPage[] = [
  {
    serviceKey: 'dealvault',
    slug: 'dealvault',
    title: 'DealVault Proof Records, Milestones, And Payout Tracking',
    seoTitle: 'DealVault Proof Records, Payout Tracking, And Milestone Accountability',
    metaDescription:
      'Use DealVault to organize agreements, milestones, payouts, and proof certificates so teams can reduce follow-up confusion without replacing legal or escrow workflows.',
    excerpt:
      'DealVault is a premium record product for teams that need cleaner agreement history, milestone tracking, and payout accountability.',
    audience:
      'Real estate teams, private lenders, contractors, agencies, and businesses that need clearer agreement records, payouts, and partner accountability.',
    primaryRoute: '/dealvault/demo',
    primaryCta: 'Request DealVault Demo',
    secondaryRoute: '/dealvault',
    secondaryCta: 'View DealVault Overview',
    sections: [
      {
        heading: 'What DealVault is',
        body:
          'DealVault is a record and accountability product. It helps teams capture agreement context, milestones, payouts, and supporting documents so follow-up stays clear when multiple parties are involved.',
        bullets: [
          'Agreement timeline and milestone history',
          'Payout tracking and accountability notes',
          'Proof certificates and supporting documents',
          'Status updates your team can review',
        ],
      },
      {
        heading: 'When DealVault is the right fit',
        body:
          'DealVault is useful when partners need clarity around what was agreed to, what was delivered, what was paid, and what evidence exists for each step — especially when teams grow or responsibilities change.',
      },
      {
        heading: 'How VestBlock keeps it safe and compliant',
        body:
          'DealVault is not a replacement for legal counsel, escrow, title, brokerage compliance, or custody. It focuses on record organization and accountability so the right professionals can still operate the transaction.',
      },
    ],
    faqs: [
      {
        question: 'Is DealVault an escrow or payment processor?',
        answer:
          'No. DealVault is a record product. It organizes records and milestones, but it does not hold funds, move money, or replace escrow and settlement workflows.',
      },
      {
        question: 'Does DealVault replace legal agreements or compliance requirements?',
        answer:
          'No. DealVault helps track what happened and store supporting records. Teams still use the proper legal and compliance processes for contracts and transactions.',
      },
      {
        question: 'What is the safest first step?',
        answer:
          'Start with the DealVault demo and walkthrough request. VestBlock can then confirm fit, scope, and next steps for your team.',
      },
    ],
    relatedSlugs: ['real-estate-funding', 'vestblock-ai-assistant', 'visibility-expansion-saas'],
  },
  {
    serviceKey: 'credit_analysis',
    slug: 'ai-credit-analysis',
    title: 'Credit Review Tools For Credit Repair Planning',
    seoTitle: 'Credit Review Tools For Credit Repair And Dispute Planning',
    metaDescription:
      'Use VestBlock credit review tools to organize credit report issues, understand dispute opportunities, and prepare next steps without score guarantees.',
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
          'VestBlock credit review tools organize uploaded credit report text into practical credit repair categories. The goal is clarity: which items may need documentation, which accounts may require dispute review, and which next steps make sense before letters are generated.',
        bullets: [
          'Organizes negative items and account details',
          'Helps identify dispute-letter starting points',
          'Connects report status to review notes and email alerts',
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
        question: 'Do these credit review tools repair my credit automatically?',
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
    title: 'Business Funding Eligibility Check',
    seoTitle: 'Business Funding Eligibility Checker And Funding Prep Plan',
    metaDescription:
      'Check business funding eligibility for free, then use VestBlock prep services if documents, revenue, credit, or business structure need work first.',
    excerpt:
      'VestBlock helps business owners understand whether they should apply now, prepare first, or move into a clearer funding prep plan.',
    audience:
      'Business owners comparing funding options, document gaps, credit profile, and use-of-funds requirements.',
    primaryRoute: '/funding#free-eligibility-check',
    primaryCta: 'Check Funding Eligibility Free',
    secondaryRoute: '/funding/business-funding-strategy',
    secondaryCta: 'Review Funding Prep Plan',
    sections: [
      {
        heading: 'Start with a free funding check',
        body:
          'The free funding checker helps a business owner compare basic factors before applying. It looks at the kind of details lenders and funding partners often care about, such as business stage, revenue, credit profile, documentation, and intended use of funds.',
        bullets: [
          'Business profile and registration basics',
          'Revenue and banking history',
          'Personal credit and utilization considerations',
          'Funding amount and use-of-funds clarity',
        ],
      },
      {
        heading: 'When paid help makes sense',
        body:
          'Some owners are not ready to apply right away. VestBlock can recommend paid prep when the business needs cleaner records, better documents, lower risk factors, or a more realistic funding plan before applications.',
      },
      {
        heading: 'What VestBlock does not promise',
        body:
          'VestBlock does not guarantee approvals, terms, limits, rates, or funding timelines. The platform helps prepare the next step so owners can make better decisions before they apply.',
      },
    ],
    faqs: [
      {
        question: 'Is the business funding eligibility check free?',
        answer:
          'Yes. The initial funding check is free. If the business needs preparation before applying, VestBlock may recommend a paid funding plan.',
      },
      {
        question: 'What if my business is not eligible yet?',
        answer:
          'The next step is usually preparation: organize documents, clarify revenue, review credit factors, and avoid applying too early.',
      },
      {
        question: 'Does VestBlock fund the business directly?',
        answer:
          'VestBlock helps with preparation, review, and follow-up. Actual funding depends on partners, lenders, underwriting, terms, and user decisions.',
      },
    ],
    relatedSlugs: ['business-funding-strategy', 'business-setup-funding-grants'],
  },
  {
    serviceKey: 'credit_card_stacking',
    slug: 'business-funding-strategy',
    title: 'Business Funding Prep Plan',
    seoTitle: 'Business Funding Prep Plan And Credit Line Readiness',
    metaDescription:
      'Prepare for business credit funding with VestBlock document checks, inquiry-risk consent, utilization guidance, and follow-up.',
    excerpt:
      'VestBlock helps business owners understand the risk, documents, and repayment considerations before pursuing a business credit funding sequence.',
    audience:
      'Business owners considering business credit lines or business credit line working-capital options.',
    primaryRoute: '/funding/business-funding-strategy',
    primaryCta: 'Start The Funding Prep Plan',
    secondaryRoute: '/funding#free-eligibility-check',
    secondaryCta: 'Check Eligibility First',
    sections: [
      {
        heading: 'What this funding prep plan covers',
        body:
          'A business credit line prep plan reviews multiple funding options in a planned sequence. Because that can involve hard inquiries, utilization risk, fees, and repayment pressure, VestBlock treats it as preparation and consent, not an instant approval promise.',
        bullets: [
          'Review business and personal credit factors',
          'Check business documents and banking basics',
          'Explain hard-inquiry and repayment considerations',
          'Capture success-fee consent only where applicable',
        ],
      },
      {
        heading: 'How the VestBlock offer is priced',
        body:
          'The current offer uses a $300 funding prep plan plus a 10% success fee only after accepted business credit funding is available. This keeps the paid setup separate from any final lender or issuer decision.',
      },
      {
        heading: 'What owners should know before applying',
        body:
          'Applying too early can create avoidable inquiries or debt pressure. A better process checks documents, scores, balances, revenue, repayment plan, and current business need before a sequence begins.',
      },
    ],
    faqs: [
      {
        question: 'Does this prep plan guarantee business funding?',
        answer:
          'No. Card approvals, limits, terms, and fees depend on issuers, underwriting, credit profile, income, business details, and user decisions.',
      },
      {
        question: 'Why charge a funding plan fee?',
        answer:
          'The plan fee covers review, organization, risk checks, and preparation before applications are pursued. It is not a guarantee of approval.',
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
    title: 'Business Setup for Funding and Grants',
    seoTitle: 'Business Setup for Funding, Grants, and Business Credit',
    metaDescription:
      'Prepare business records, EIN, business banking, documents, business credit basics, and use-of-funds details before funding or grant applications.',
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
          'Business registration and EIN basics',
          'Business bank account setup',
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
          'Many business funding options expect a clear business identity, and an EIN is often part of that setup. Requirements still vary by product, lender, and program.',
      },
      {
        question: 'Can setup help with grants too?',
        answer:
          'Yes. Grant applications often require clear documents, business details, use-of-funds language, and proof that the business fits the program.',
      },
      {
        question: 'Is this legal or tax advice?',
        answer:
          'No. VestBlock provides preparation guidance and organization. Owners should use qualified professionals for legal, tax, or accounting decisions.',
      },
    ],
    relatedSlugs: ['business-funding-eligibility', 'small-business-grants'],
  },
  {
    serviceKey: 'financial_growth_services',
    slug: 'financial-growth-services',
    title: 'Funding And Business Credit Prep Reviews',
    seoTitle: 'Funding And Business Credit Prep Reviews',
    metaDescription:
      'Request VestBlock prep reviews for funding readiness, business credit, grants, utilization, cash-flow documents, and real estate funding.',
    excerpt:
      'VestBlock offers focused prep reviews for owners who need a clearer plan before they apply, submit documents, or talk to lenders.',
    audience:
      'Business owners who need a practical review before funding, grants, business credit, or real estate funding steps.',
    primaryRoute: '/services/financial-growth',
    primaryCta: 'Request Prep Review',
    secondaryRoute: '/services/financial-growth#request-service',
    secondaryCta: 'Compare Prep Reviews',
    sections: [
      {
        heading: 'What these reviews are for',
        body:
          'Funding and business credit prep reviews turn broad goals into clear preparation work. Each review has a defined scope, price range, and follow-up so customers know what happens before deeper funding or credit work begins.',
        bullets: [
          'Funding Prep Snapshot',
          'Business Credit Builder Sprint',
          'Grant Application Prep Review',
          'Debt And Utilization Paydown Plan',
          'Cash Flow And Bank Statement Review',
          'Real Estate Deal Funding Review',
        ],
      },
      {
        heading: 'How this helps customers move forward',
        body:
          'Each request includes the selected review, business details, goal, and follow-up context. That helps the customer understand what happens next and helps VestBlock follow through clearly.',
      },
      {
        heading: 'What is not included',
        body:
          'These packages do not guarantee approvals, awards, credit score outcomes, or lender terms. They are preparation and review services.',
      },
    ],
    faqs: [
      {
        question: 'Which prep review should I choose?',
        answer:
          'Start with the package closest to the immediate goal: funding prep, business credit, grants, debt utilization, cash-flow documents, or real estate deal review.',
      },
      {
        question: 'Are these one-time packages?',
        answer:
          'Yes. The current offer is structured as one-time preparation packages, with deeper funding support available where appropriate.',
      },
      {
        question: 'Can this replace a lender, CPA, attorney, or financial advisor?',
        answer:
          'No. VestBlock helps with preparation and organization. Specialized legal, tax, accounting, investment, or underwriting advice should come from qualified professionals.',
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
      'Use VestBlock to review grant requirements, match business details to opportunities, and draft stronger application language for hands-on review.',
    excerpt:
      'VestBlock helps business owners organize grant details, deadlines, documents, and application language without promising awards.',
    audience:
      'Small business owners searching for grant opportunities and clearer application preparation.',
    primaryRoute: '/tools/grants',
    primaryCta: 'Find Grant Matches',
    secondaryRoute: '/business-setup',
    secondaryCta: 'Prepare For Grants',
    sections: [
      {
        heading: 'What grant preparation means',
        body:
          'Grant preparation is not just finding a list of programs. Owners need to understand eligibility, deadlines, requested documents, business purpose, budget, and how the opportunity connects to their real use of funds.',
        bullets: [
          'Business profile and industry match',
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
          'Clear eligibility, strong documentation, specific use of funds, realistic outcomes, and complete answers usually matter more than generic language.',
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
      'Una pagina clara en espanol para duenos de negocio que quieren prepararse antes de solicitar financiamiento.',
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
          'Esta pagina es para duenos de negocio que quieren entender que preparar antes de revisar opciones de financiamiento. El enfoque esta en documentos, credito, banco comercial, ingresos, uso de fondos y siguientes pasos.',
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
          'VestBlock organiza la preparacion y conecta al dueno con paginas, herramientas y seguimiento claro. Cuando sea apropiado, tambien se puede revisar la opcion en espanol de Bank Breezy.',
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
          'Bank Breezy es una opcion de socio que los usuarios pueden revisar. VestBlock mantiene la preparacion y el seguimiento separados de cualquier decision externa.',
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
      'Submit DSCR, rental, fix-and-flip, hard-money, or deal funding details so VestBlock can review the opportunity and follow up with context.',
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
          'A real estate funding conversation needs more than a name and phone number. VestBlock collects deal type, property details, requested amount, liquidity, borrower setup, DSCR or rental context, contractor details, and notes that help the team respond with better context.',
        bullets: [
          'DSCR and rental deal context',
          'Fix-and-flip or hard-money details',
          'Requested amount and use of funds',
          'Borrower setup and key documents',
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
          'No. VestBlock captures the opportunity for review. Financing depends on review, underwriting, lender or partner requirements, and borrower decisions.',
      },
    ],
    relatedSlugs: ['financial-growth-services', 'sell-property'],
  },
  {
    serviceKey: 'sell_property',
    slug: 'sell-property',
    title: 'Seller Property Review For Fast Cash, Creative, Or Novation Paths',
    seoTitle: 'Seller Property Review For Fast Cash, Creative Finance, And Novation Paths',
    metaDescription:
      'Use VestBlock to submit property details for fast cash buyer, creative structure, novation, or partner seller review without a promised offer.',
    excerpt:
      'VestBlock helps property owners submit the details needed to compare fast cash, creative, novation, and partner sale conversations.',
    audience:
      'Property owners who want a fast cash buyer review, creative structure review, novation review, or another better-fit sale conversation.',
    primaryRoute: '/sell',
    primaryCta: 'Request Property Review',
    secondaryRoute: '/real-estate-funding',
    secondaryCta: 'Review Real Estate Funding',
    sections: [
      {
        heading: 'What sellers can submit',
        body:
          'The sell-property flow collects property address, property type, condition, occupancy, estimated value, desired price, payoff, liens or taxes, timeline, preferred sale path, and contact preferences. That gives the follow-up team a better starting point.',
        bullets: [
          'Property and occupancy details',
          'Condition and repair context',
          'Estimated value and desired sale price',
          'Fast cash, creative structure, or novation preference',
          'Best time and method for follow-up',
        ],
      },
      {
        heading: 'When this option makes sense',
        body:
          'This option is useful when an owner wants a fast cash conversation, has an as-is property, is open to creative structure, wants to review a novation path, or needs to understand which sale path is most realistic.',
      },
      {
        heading: 'Keeping expectations clear',
        body:
          'VestBlock does not promise a specific offer before review. Any fast cash offer, creative structure, novation path, timeline, closing, or buyer conversation depends on the property, market, title, condition, payoff, and buyer interest.',
      },
    ],
    faqs: [
      {
        question: 'Will I get a guaranteed cash offer?',
        answer:
          'No. Submitting the form starts a review and follow-up process. Any cash offer, creative structure, or novation path depends on the property, title, payoff, market, and buyer review.',
      },
      {
        question: 'Can VestBlock review creative finance or novation options?',
        answer:
          'Yes. Sellers can request review for fast cash, creative structure, or novation paths. VestBlock still reviews the property details first because not every property or payoff situation fits every route.',
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
    title: 'AI Receptionist, Booking, and Website Upgrades',
    seoTitle: 'AI Receptionist, Booking, and Website Upgrades | VestBlock',
    metaDescription:
      'Compare VestBlock AI receptionist, appointment-booking, and website-upgrade offers for service businesses that need stronger lead capture and conversion.',
    excerpt:
      'VestBlock offers AI receptionist, booking, and website-upgrade services for businesses that need more leads to turn into real conversations.',
    audience:
      'Owners who want more leads, better appointment flow, and a clearer move from website traffic to booked conversations.',
    primaryRoute: '/ai-assistant',
    primaryCta: 'Compare AI Receptionist Packages',
    secondaryRoute: '/pricing',
    secondaryCta: 'Compare Pricing',
    sections: [
      {
        heading: 'What these services are for',
        body:
          'These offers are built for businesses that need to capture more of the traffic they already have. Instead of relying on a weak contact page or missed calls, VestBlock packages AI receptionist, booking, and website conversion support into clear services.',
        bullets: [
          'AI receptionist setup for website lead capture',
          'Appointment-booking flow for service businesses',
          'Website upgrades for weak lead capture',
          'Follow-up notes and routed service requests',
        ],
      },
      {
        heading: 'How VestBlock positions the service',
        body:
          'VestBlock sells setup, automation, and conversion support. The service is not positioned as a guarantee of revenue, booked jobs, or closed sales. Better lead capture helps, but the business still has to answer, fulfill, and follow up well.',
      },
      {
        heading: 'Why the pricing is structured this way',
        body:
          'Setup fees cover implementation, training, and launch work. Monthly pricing covers the ongoing assistant or booking support. Website upgrade work is scoped separately because page count, design cleanup, and revisions can vary a lot from one business to another.',
      },
    ],
    faqs: [
      {
        question: 'What is the difference between the receptionist and booking offers?',
        answer:
          'The receptionist offer focuses on lead capture, FAQs, and routing. The booking offer adds calendar flow, qualification questions, and stronger appointment handling for businesses that need real scheduling support.',
      },
      {
        question: 'Do these services guarantee more revenue or appointments?',
        answer:
          'No. They improve lead capture and conversion, but results still depend on traffic quality, follow-up speed, market demand, and business operations.',
      },
      {
        question: 'What if my website needs more than a light refresh?',
        answer:
          'VestBlock can start with the Website Upgrade Sprint scope and then quote a larger build separately if the site needs more pages, heavier design work, or custom functionality.',
      },
    ],
    relatedSlugs: ['website-upgrade-sprint', 'ai-receptionist-launch', 'ai-appointment-booking-system'],
  },
  {
    serviceKey: 'visibility_expansion',
    slug: 'visibility-expansion-saas',
    title: 'Search Visibility for SEO, AI Answers, and PR Growth',
    seoTitle: 'Search Visibility for SEO, AI Answers, and PR | VestBlock',
    metaDescription:
      'Use VestBlock visibility packages to improve search presence, AI-answer coverage, city pages, and authority-building without vague retainers.',
    excerpt:
      'VestBlock packages SEO, AI-answer coverage, city pages, and PR authority work into clearer monthly services.',
    audience:
      'Businesses that want clearer search presence, stronger AI-answer coverage, and more trusted brand mentions.',
    primaryRoute: '/visibility-expansion',
    primaryCta: 'Compare Visibility Packages',
    secondaryRoute: '/pricing#visibility-expansion',
    secondaryCta: 'Compare Pricing',
    sections: [
      {
        heading: 'What this service is for',
        body:
          'This visibility service is built for businesses that want more than isolated blog posts or generic SEO retainers. The goal is simple: clearer search presence, stronger AI-answer coverage, smarter city pages, and authority work that helps buyers find and trust the company.',
        bullets: [
          'Search structure and page priorities',
          'AI-answer question and topic coverage',
          'City and service page planning',
          'PR and authority-building support',
        ],
      },
      {
        heading: 'How VestBlock frames the work',
        body:
          'VestBlock sells strategy, implementation planning, content direction, and monthly visibility support. The service is not positioned as guaranteed rankings, media coverage, traffic, or revenue.',
      },
      {
        heading: 'Why this is easier to sell',
        body:
          'Productized visibility packages give the customer a defined starting point instead of an open-ended marketing retainer. That makes the offer easier to understand, scope, and fulfill.',
      },
    ],
    faqs: [
      {
        question: 'What is the difference between SEO, AI answers, and PR in this offer?',
        answer:
          'SEO focuses on search discovery, AI-answer coverage helps buyers find you in answer tools, and PR supports authority, mentions, backlinks, and brand trust. The packages combine them where they reinforce each other.',
      },
      {
        question: 'Does this guarantee rankings or traffic?',
        answer:
          'No. VestBlock improves the visibility plan and monthly execution, but rankings, citations, traffic, and market response still depend on competition, site quality, and follow-through.',
      },
      {
        question: 'Who should start with the city-page or authority package?',
        answer:
          'The city-page package helps businesses growing into multiple service areas. Authority PR is better once the site and core offer are clear enough to support outreach and citations.',
      },
    ],
    relatedSlugs: ['vestblock-ai-assistant', 'financial-growth-services', 'small-business-grants'],
  },
];

const publicPricedOfferSeoPages = pricedVestBlockOffers;

const pricedOfferSeoPages: ServiceSeoPage[] = publicPricedOfferSeoPages.map((offer) => ({
  serviceKey: offer.serviceKey,
  slug: offer.slug,
  title: offer.title,
  seoTitle: offer.title,
  metaDescription: `${offer.title} for ${offer.bestFor.toLowerCase()} Price: ${offer.priceLabel}.`,
  excerpt: offer.summary,
  audience: offer.bestFor,
  primaryRoute: offer.primaryRoute,
  primaryCta: offer.primaryCta,
  secondaryRoute: offer.secondaryRoute ?? offer.parentServiceRoute,
  secondaryCta: offer.secondaryCta ?? `Compare ${offer.parentServiceLabel}`,
  sections: [
    {
      heading: 'What this service includes',
      body:
        `${offer.title} gives you a clearly scoped paid service inside VestBlock so you know what you are buying before you move forward.`,
      bullets: offer.deliverables,
    },
    {
      heading: 'Who this paid offer is for',
      body: offer.bestFor,
    },
    {
      heading: 'How this service is framed',
      body: offer.complianceNote,
    },
  ],
  faqs: [
    {
      question: 'Is this price a guarantee of results?',
      answer:
        'No. VestBlock prices its tools, reviews, and preparation work separately from any issuer, lender, grant committee, or property decision.',
    },
    {
      question: 'What happens after I choose this service?',
      answer:
        offer.category === 'financial_growth'
          ? 'Your request is routed into the VestBlock service form so the team can review the package, your goal, and the next follow-up step.'
          : 'You move into the linked VestBlock page where your profile, preparation details, and next steps can be saved and reviewed.',
    },
    {
      question: 'Can I compare this with other VestBlock offers first?',
      answer:
        `Yes. You can review the main ${offer.parentServiceLabel} page before choosing this paid offer.`,
    },
  ],
  relatedSlugs: Array.from(
    new Set(
      [
        baseServiceSeoPages.find((page) => page.serviceKey === offer.serviceKey)?.slug,
        'financial-growth-services',
        'business-funding-eligibility',
      ].filter((slug): slug is string => Boolean(slug) && slug !== offer.slug)
    )
  ).slice(0, 3),
  priceLabel: offer.priceLabel,
}));

export const serviceSeoPages: ServiceSeoPage[] = [
  ...baseServiceSeoPages,
  ...pricedOfferSeoPages,
];

export function getServiceSeoPage(slug: string) {
  return serviceSeoPages.find((page) => page.slug === slug);
}

export function getServiceSeoPageByServiceKey(serviceKey: string) {
  return serviceSeoPages.find((page) => page.serviceKey === serviceKey);
}
