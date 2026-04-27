export type AeoTopic = {
  slug: string;
  title: string;
  cluster:
    | 'credit-repair'
    | 'business-credit'
    | 'funding'
    | 'credit-builder'
    | 'disputes';
  intent: 'education' | 'comparison' | 'lead-capture' | 'tool-support';
  offerPath: string;
  metaDescription: string;
  audience: string;
  overview: string;
  keyTakeaways: string[];
  actionSteps: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
};

export const clusterLabels: Record<AeoTopic['cluster'], string> = {
  'credit-repair': 'AI Credit Repair',
  'business-credit': 'Business Credit',
  funding: 'Funding Readiness',
  'credit-builder': 'Credit Builder Tools',
  disputes: 'Credit Disputes',
};

export const intentLabels: Record<AeoTopic['intent'], string> = {
  education: 'Learn',
  comparison: 'Compare',
  'lead-capture': 'Get Ready',
  'tool-support': 'Use A Tool',
};

export const vestblockAeoTopics: AeoTopic[] = [
  {
    slug: 'ai-credit-repair',
    title: 'AI Credit Repair',
    cluster: 'credit-repair',
    intent: 'lead-capture',
    offerPath: '/credit-upload',
    metaDescription:
      'Learn how AI credit repair support can organize report issues, dispute options, and next steps without making unrealistic credit promises.',
    audience: 'People who want a faster way to understand what is hurting their credit report.',
    overview:
      'AI credit repair support is most useful when it helps you read a report, spot possible inaccurate or unverifiable items, and organize the documents needed for a dispute. It should not promise a score jump or remove accurate information. VestBlock focuses on the practical side: upload, analysis, dispute-letter support, and next-step tracking.',
    keyTakeaways: [
      'AI can help summarize report problems, but you stay in control of what gets disputed.',
      'Good credit repair depends on documentation, accuracy, and follow-through.',
      'The safest tools explain options instead of guaranteeing deletions or scores.',
    ],
    actionSteps: [
      'Upload a current credit report before making a dispute plan.',
      'Review negative items for accuracy, dates, balances, ownership, and reporting consistency.',
      'Use dispute letters only when you have a clear reason and supporting details.',
    ],
    faqs: [
      {
        question: 'Can AI repair my credit automatically?',
        answer:
          'AI can help organize and draft your credit repair work, but credit bureaus and furnishers decide how disputes are handled. You should review every letter and claim before sending anything.',
      },
      {
        question: 'What should I upload first?',
        answer:
          'Start with a recent credit report that includes account history, collections, inquiries, balances, and bureau details.',
      },
    ],
  },
  {
    slug: 'credit-dispute-letters',
    title: 'Credit Dispute Letters',
    cluster: 'disputes',
    intent: 'tool-support',
    offerPath: '/tools/my-dispute-letters',
    metaDescription:
      'Understand when credit dispute letters are useful, what they should include, and how VestBlock helps organize letter drafting.',
    audience: 'Consumers preparing to challenge inaccurate or unverifiable report items.',
    overview:
      'A credit dispute letter should be specific, factual, and tied to a real concern on your report. Strong letters usually identify the account, explain the issue, request investigation, and include supporting documents when available. VestBlock helps turn report analysis into organized dispute-letter drafts.',
    keyTakeaways: [
      'A vague dispute is easier to ignore than a documented, specific one.',
      'Each letter should match the issue: collection, charge-off, late payment, inquiry, or identity concern.',
      'Keep copies of letters, reports, documents, and bureau responses.',
    ],
    actionSteps: [
      'Identify the exact account or item you want reviewed.',
      'Write the dispute reason in plain, accurate language.',
      'Attach documents that support your position when you have them.',
    ],
    faqs: [
      {
        question: 'Do dispute letters need legal language?',
        answer:
          'No. Clear, factual language is usually better than complicated wording. The key is explaining what is wrong and what you want investigated.',
      },
      {
        question: 'Can VestBlock generate a letter for me?',
        answer:
          'VestBlock can help draft letters from your report analysis, but you should review and approve every letter before using it.',
      },
    ],
  },
  {
    slug: '609-letters',
    title: '609 Letters',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/super-dispute',
    metaDescription:
      'Learn what 609 letters are commonly used for, what they can and cannot do, and how to avoid credit repair myths.',
    audience: 'People researching 609 letters before sending a dispute.',
    overview:
      'A 609 letter is commonly discussed as a way to request verification of information on a credit report. It is not a magic deletion letter. A better approach is to use the rights behind credit reporting law responsibly: ask for investigation, be specific, and avoid claims you cannot support.',
    keyTakeaways: [
      '609 letters are often oversold online.',
      'A request for verification should still identify a real reporting concern.',
      'No letter format can guarantee a deletion.',
    ],
    actionSteps: [
      'Check whether the item is inaccurate, outdated, duplicated, or unverifiable.',
      'Collect report pages and documents before drafting.',
      'Keep the request focused on investigation and verification.',
    ],
    faqs: [
      {
        question: 'Will a 609 letter remove negative accounts?',
        answer:
          'Not by itself. A bureau may update, verify, or remove information depending on its investigation and the furnisher response.',
      },
      {
        question: 'Is a 609 letter the same as a dispute letter?',
        answer:
          'It is usually used as a type of verification request. In practice, the strongest letters are still clear, factual disputes.',
      },
    ],
  },
  {
    slug: 'method-of-verification',
    title: 'Method Of Verification',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/super-dispute',
    metaDescription:
      'Learn how method-of-verification requests fit into credit disputes and what information to track after a bureau response.',
    audience: 'Consumers following up after a credit bureau verifies disputed information.',
    overview:
      'A method-of-verification request asks how a bureau verified information after a dispute. It can help you understand the investigation trail, but it is not a shortcut around documentation. Use it when you need a clearer record of what was checked and who supplied the information.',
    keyTakeaways: [
      'This is usually a follow-up step after a dispute result.',
      'It works best when you track dates, bureaus, account names, and response letters.',
      'It should support a bigger documentation strategy.',
    ],
    actionSteps: [
      'Save the bureau response that verified the item.',
      'Request the verification method for the specific account or item.',
      'Compare the response with your documents and report details.',
    ],
    faqs: [
      {
        question: 'When should I request method of verification?',
        answer:
          'Usually after a bureau verifies an item and you want to understand how that decision was reached.',
      },
      {
        question: 'Does method of verification force deletion?',
        answer:
          'No. It can provide useful information, but deletion depends on whether the reporting can be verified and is accurate.',
      },
    ],
  },
  {
    slug: 'charge-off-disputes',
    title: 'Charge-Off Disputes',
    cluster: 'disputes',
    intent: 'tool-support',
    offerPath: '/credit-upload',
    metaDescription:
      'Review charge-off dispute basics, common reporting issues, and how to organize a careful dispute plan.',
    audience: 'Consumers reviewing charged-off accounts on a credit report.',
    overview:
      'A charge-off can affect credit for years, so disputes should be handled carefully. The goal is not to deny accurate debt. The goal is to check whether the reporting is accurate, complete, timely, and consistent across bureaus.',
    keyTakeaways: [
      'Charge-off status, balance, dates, and ownership should be reviewed closely.',
      'Disputing accurate debt without a reason can waste time.',
      'Documentation matters more than aggressive wording.',
    ],
    actionSteps: [
      'Compare charge-off details across all bureaus.',
      'Look for incorrect balances, duplicate collections, or date errors.',
      'Prepare a focused letter for each bureau or furnisher issue.',
    ],
    faqs: [
      {
        question: 'Can I dispute a charge-off?',
        answer:
          'Yes, if you believe information is inaccurate, incomplete, outdated, duplicated, or unverifiable.',
      },
      {
        question: 'Should I dispute every charge-off?',
        answer:
          'Not automatically. Review each account and choose disputes based on specific reporting concerns.',
      },
    ],
  },
  {
    slug: 'collection-disputes',
    title: 'Collection Disputes',
    cluster: 'disputes',
    intent: 'tool-support',
    offerPath: '/credit-upload',
    metaDescription:
      'Learn how collection disputes work and what to check before challenging a collection account.',
    audience: 'People with collection accounts who want a cleaner dispute plan.',
    overview:
      'Collection disputes often involve ownership, dates, balances, duplicate reporting, or whether the collector can validate the debt. A good plan separates credit bureau disputes from debt validation requests and keeps records of every response.',
    keyTakeaways: [
      'Credit bureau disputes and debt validation requests are related but different.',
      'Collection balances and dates often need careful review.',
      'A dispute should be based on a specific issue, not just the presence of a collection.',
    ],
    actionSteps: [
      'Identify the collector, original creditor, balance, and open date.',
      'Check whether the same debt appears more than once.',
      'Use the right letter type for bureau reporting or collector validation.',
    ],
    faqs: [
      {
        question: 'What is the first step with a collection account?',
        answer:
          'Confirm who is reporting it, what debt it claims to represent, and whether the details match your records.',
      },
      {
        question: 'Can a paid collection still appear?',
        answer:
          'Often yes, but it should report accurately. If the status or balance is wrong, that may be dispute-worthy.',
      },
    ],
  },
  {
    slug: 'business-credit',
    title: 'Business Credit',
    cluster: 'business-credit',
    intent: 'lead-capture',
    offerPath: '/tools/business-credit',
    metaDescription:
      'Learn how business credit works, what lenders look for, and how to prepare your company profile for funding opportunities.',
    audience: 'Business owners preparing for vendor accounts, cards, or funding.',
    overview:
      'Business credit is built through company identity, trade relationships, payment history, and lender-ready documentation. Before chasing funding, make sure your business profile is consistent and your credit/funding story is easy to verify.',
    keyTakeaways: [
      'Business identity consistency matters: name, address, phone, EIN, and web presence.',
      'Vendor accounts and payment history can support business credit growth.',
      'Personal credit may still matter for many early-stage funding products.',
    ],
    actionSteps: [
      'Check business registration, address, phone, and online listings.',
      'Organize revenue, bank statements, and entity documents.',
      'Review which funding or credit products match your current stage.',
    ],
    faqs: [
      {
        question: 'Can I build business credit without perfect personal credit?',
        answer:
          'Sometimes, but many products still consider personal credit, especially for newer businesses. Preparation improves your options.',
      },
      {
        question: 'What should I fix before applying?',
        answer:
          'Start with business identity consistency, documentation, revenue clarity, and any personal credit issues that could affect approval.',
      },
    ],
  },
  {
    slug: 'ein-business-credit',
    title: 'EIN Business Credit',
    cluster: 'business-credit',
    intent: 'education',
    offerPath: '/tools/business-credit',
    metaDescription:
      'Understand what EIN business credit means, where it helps, and why EIN-only funding claims should be treated carefully.',
    audience: 'Business owners researching EIN-only credit claims.',
    overview:
      'An EIN helps identify your business, but it does not automatically replace personal credit or guarantee approvals. EIN business credit works best when your business is properly set up, consistent across records, and building real payment history.',
    keyTakeaways: [
      'An EIN is an identifier, not instant business credit.',
      'Some accounts may report to business bureaus, while others do not.',
      'Be cautious with offers promising easy EIN-only approvals.',
    ],
    actionSteps: [
      'Confirm your entity and EIN records match your public business profile.',
      'Choose vendor or credit accounts that fit your stage.',
      'Track which accounts report and whether payments post accurately.',
    ],
    faqs: [
      {
        question: 'Does an EIN hide personal credit?',
        answer:
          'No. Many lenders can still ask for personal credit, a personal guarantee, or owner information.',
      },
      {
        question: 'How do I start building EIN business credit?',
        answer:
          'Set up a consistent business profile, open appropriate accounts, pay on time, and monitor reporting.',
      },
    ],
  },
  {
    slug: 'funding-readiness',
    title: 'Funding Readiness',
    cluster: 'funding',
    intent: 'lead-capture',
    offerPath: '/funding',
    metaDescription:
      'Prepare for business funding by reviewing credit, revenue, documentation, and lender-fit before applying.',
    audience: 'Business owners trying to improve approval odds before funding applications.',
    overview:
      'Funding readiness is the work you do before applying. It includes reviewing credit, business identity, bank activity, revenue, documents, and the type of funding that actually fits your situation.',
    keyTakeaways: [
      'A clean application starts before the application form.',
      'Lender-fit matters as much as raw revenue or credit score.',
      'Missing documents can slow down or weaken an otherwise promising file.',
    ],
    actionSteps: [
      'Review personal and business credit before applying.',
      'Organize bank statements, tax documents, entity records, and revenue details.',
      'Match the funding product to your stage, use case, and repayment ability.',
    ],
    faqs: [
      {
        question: 'What makes a business funding-ready?',
        answer:
          'Consistent business records, clear revenue, organized documents, and a funding product that matches the business profile.',
      },
      {
        question: 'Should I apply before fixing credit issues?',
        answer:
          'It depends on the product, but reviewing credit first can help you avoid avoidable denials or poor terms.',
      },
    ],
  },
  {
    slug: 'grants-for-small-businesses',
    title: 'Grants For Small Businesses',
    cluster: 'funding',
    intent: 'education',
    offerPath: '/tools/grants',
    metaDescription:
      'Learn how small business grants work, what to prepare, and why grant searches should be treated as a documentation process.',
    audience: 'Small business owners looking for realistic grant opportunities.',
    overview:
      'Small business grants are competitive and usually tied to eligibility, location, industry, purpose, or community impact. Strong applications depend on fit, documentation, and a clear use of funds.',
    keyTakeaways: [
      'Most grants are not general free money for any business.',
      'Eligibility and application quality matter more than volume.',
      'A good grant search should connect opportunities to your business profile.',
    ],
    actionSteps: [
      'Clarify your business type, location, ownership, and funding purpose.',
      'Prepare a short business summary and use-of-funds statement.',
      'Track deadlines, documents, and follow-up requirements.',
    ],
    faqs: [
      {
        question: 'Are small business grants easy to get?',
        answer:
          'Usually no. They can be valuable, but they are competitive and often have strict eligibility rules.',
      },
      {
        question: 'What should I prepare before applying?',
        answer:
          'Business documents, a concise story, financial details, eligibility proof, and a specific use of funds.',
      },
    ],
  },
  {
    slug: 'credit-builder-tools',
    title: 'Credit Builder Tools',
    cluster: 'credit-builder',
    intent: 'comparison',
    offerPath: '/dashboard',
    metaDescription:
      'Compare common credit builder tools and learn how they fit into a broader credit improvement plan.',
    audience: 'People looking for safer ways to build positive credit history.',
    overview:
      'Credit builder tools can help when they add positive payment history, lower utilization, or improve account mix. They are not a substitute for fixing inaccurate report issues or managing debt, but they can support a broader plan.',
    keyTakeaways: [
      'The right tool depends on your current report, cash flow, and goals.',
      'On-time payments and low utilization are still the basics.',
      'Fees and reporting details should be reviewed before signing up.',
    ],
    actionSteps: [
      'Review your report to see what is missing or hurting your profile.',
      'Compare fees, reporting bureaus, and payment requirements.',
      'Track whether the account reports correctly over time.',
    ],
    faqs: [
      {
        question: 'Do credit builder tools always help?',
        answer:
          'No. They help only when they fit your profile and are managed correctly.',
      },
      {
        question: 'What should I compare first?',
        answer:
          'Look at cost, bureau reporting, payment schedule, utilization impact, and cancellation terms.',
      },
    ],
  },
  {
    slug: 'secured-credit-cards',
    title: 'Secured Credit Cards',
    cluster: 'credit-builder',
    intent: 'comparison',
    offerPath: '/dashboard',
    metaDescription:
      'Learn how secured credit cards work, what to compare, and how to use them without hurting utilization.',
    audience: 'People rebuilding or starting credit with a deposit-backed card.',
    overview:
      'A secured credit card uses a deposit to reduce lender risk. It can help build payment history if it reports to the bureaus and is used carefully. The main risk is carrying high utilization or missing payments.',
    keyTakeaways: [
      'Confirm the card reports to major credit bureaus.',
      'Keep balances low compared with the limit.',
      'Review fees and graduation options before applying.',
    ],
    actionSteps: [
      'Compare annual fees, deposit requirements, and bureau reporting.',
      'Use the card for small recurring purchases.',
      'Pay on time and keep utilization low.',
    ],
    faqs: [
      {
        question: 'How much should I use on a secured card?',
        answer:
          'Many people aim to keep utilization low and pay the card on time every month.',
      },
      {
        question: 'Can a secured card become unsecured?',
        answer:
          'Some issuers offer graduation reviews, but policies vary by card issuer.',
      },
    ],
  },
  {
    slug: 'rent-reporting',
    title: 'Rent Reporting',
    cluster: 'credit-builder',
    intent: 'comparison',
    offerPath: '/dashboard',
    metaDescription:
      'Understand rent reporting services, when they may help, and what to check before using one.',
    audience: 'Renters considering adding rental payment history to their credit profile.',
    overview:
      'Rent reporting services may add rental payment history to one or more credit bureaus. They can be useful for people with thin files, but results depend on which bureaus receive the data and how the rest of the credit profile looks.',
    keyTakeaways: [
      'Not every rent reporting service reports to every bureau.',
      'Positive rent history may help thin credit files more than already complex profiles.',
      'Fees and landlord verification requirements vary.',
    ],
    actionSteps: [
      'Confirm which bureaus the service reports to.',
      'Check setup fees, monthly fees, and cancellation policies.',
      'Monitor your report after enrollment.',
    ],
    faqs: [
      {
        question: 'Does rent reporting improve every credit score?',
        answer:
          'Not always. It depends on the scoring model, bureau, and your full credit profile.',
      },
      {
        question: 'Do I need landlord approval?',
        answer:
          'Some services require landlord or payment verification, while others use bank transaction data.',
      },
    ],
  },
  {
    slug: 'tradelines-education',
    title: 'Tradelines Education',
    cluster: 'credit-builder',
    intent: 'education',
    offerPath: '/dashboard',
    metaDescription:
      'Learn what tradelines are, how they affect credit reports, and why risky tradeline claims deserve caution.',
    audience: 'People trying to understand tradelines before making credit decisions.',
    overview:
      'A tradeline is simply an account listed on a credit report. Credit cards, loans, and other reported accounts can all be tradelines. Be careful with paid tradeline schemes or claims that promise guaranteed score changes.',
    keyTakeaways: [
      'Tradeline quality depends on payment history, age, utilization, and account type.',
      'Buying access to someone else\'s account can carry risk.',
      'Building your own positive history is more durable than shortcuts.',
    ],
    actionSteps: [
      'Review existing tradelines for accuracy and utilization.',
      'Focus on on-time payments and low balances.',
      'Avoid guarantees around purchased tradelines.',
    ],
    faqs: [
      {
        question: 'Is every account a tradeline?',
        answer:
          'Every reported account is commonly called a tradeline, but not every bill or payment reports to credit bureaus.',
      },
      {
        question: 'Are paid tradelines safe?',
        answer:
          'They can be risky and may not produce the promised outcome. Review the legal, lender, and practical risks before considering them.',
      },
    ],
  },
  {
    slug: 'debt-validation',
    title: 'Debt Validation',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/super-dispute',
    metaDescription:
      'Learn what debt validation is, when to request it, and how it differs from a credit bureau dispute.',
    audience: 'Consumers contacted by collectors or reviewing collection accounts.',
    overview:
      'Debt validation is a request to a debt collector for information about a debt. It is different from disputing a credit report item with a bureau. Both can matter, but they serve different purposes and should be tracked separately.',
    keyTakeaways: [
      'Debt validation goes to the collector, not the credit bureau.',
      'Timing can matter after first contact from a collector.',
      'Keep written records of requests and responses.',
    ],
    actionSteps: [
      'Identify the collector and the debt they claim to collect.',
      'Send a clear validation request when appropriate.',
      'Compare the collector response with your records and credit report.',
    ],
    faqs: [
      {
        question: 'Is debt validation the same as a dispute?',
        answer:
          'No. Validation requests information from a collector; credit disputes ask bureaus to investigate report information.',
      },
      {
        question: 'Should I validate before paying?',
        answer:
          'If you are unsure the debt is yours or the details are unclear, validation can help you make a more informed decision.',
      },
    ],
  },
  {
    slug: 'credit-utilization',
    title: 'Credit Utilization',
    cluster: 'credit-repair',
    intent: 'education',
    offerPath: '/dashboard',
    metaDescription:
      'Learn how credit utilization affects credit profiles and what practical steps can lower reported balances.',
    audience: 'People trying to improve revolving credit usage and approval readiness.',
    overview:
      'Credit utilization compares revolving balances with credit limits. Lower utilization can support stronger credit profiles, but the timing of reported balances matters. The goal is to manage what reports, not just what you pay by the due date.',
    keyTakeaways: [
      'Utilization is usually tied to the balance reported by the issuer.',
      'High utilization can hurt even when payments are on time.',
      'Lower balances, higher limits, or better timing can improve the picture.',
    ],
    actionSteps: [
      'List each card balance and limit.',
      'Prioritize cards with the highest utilization.',
      'Watch statement/reporting dates, not only due dates.',
    ],
    faqs: [
      {
        question: 'Is 30% utilization always the goal?',
        answer:
          'It is a common guideline, but lower can be better for many profiles. The best target depends on your full report and goals.',
      },
      {
        question: 'Does paying before the due date help utilization?',
        answer:
          'It can if the lower balance is reported to the bureaus. Reporting dates vary by issuer.',
      },
    ],
  },
];

export function getAeoTopicsByCluster(cluster: AeoTopic['cluster']) {
  return vestblockAeoTopics.filter((topic) => topic.cluster === cluster);
}

export function getAeoTopicBySlug(slug: string) {
  return vestblockAeoTopics.find((topic) => topic.slug === slug) ?? null;
}

export function getRelatedAeoTopics(topic: AeoTopic, limit = 4) {
  return vestblockAeoTopics
    .filter((candidate) => candidate.slug !== topic.slug)
    .sort((a, b) => {
      const aScore =
        (a.cluster === topic.cluster ? 2 : 0) + (a.intent === topic.intent ? 1 : 0);
      const bScore =
        (b.cluster === topic.cluster ? 2 : 0) + (b.intent === topic.intent ? 1 : 0);
      return bScore - aScore || a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}
