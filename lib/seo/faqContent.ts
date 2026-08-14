/**
 * Single source of truth for page-level FAQ content.
 *
 * Each array feeds BOTH:
 *   1. The visible <FaqSection /> rendered on the page (answer-ready content)
 *   2. The FAQPage JSON-LD (faqPageJsonLd) injected into the page <head>
 *
 * Keeping them in one place guarantees the structured data matches the
 * visible content — a requirement for valid FAQ rich results and a strong
 * AEO (answer-engine) signal. Answers are written in plain language so AI
 * search engines can lift them cleanly. No guarantees or unsupported claims.
 */

export type FaqItem = { question: string; answer: string };

export const sellFaqs: FaqItem[] = [
  {
    question: 'How do I start a seller case with VestBlock?',
    answer:
      'Create a private seller case at vestblock.io/sell with the property, condition, occupancy, timeline, and your priorities. Price expectations are optional. You can save progress, resume securely, and submit the completed case for VestBlock review.',
  },
  {
    question: 'Does it cost anything to submit my property for review?',
    answer:
      'No. Saving or submitting a seller case is free. Submission places the case in VestBlock’s review queue; it does not create an offer, buyer match, agreement, or obligation.',
  },
  {
    question: 'What kinds of properties does VestBlock review?',
    answer:
      'The intake supports single-family homes, small multifamily properties, condos, townhomes, land, commercial property, and other situations. VestBlock still verifies whether it can provide a useful review after the case is submitted.',
  },
  {
    question: 'Does VestBlock set a sale or closing timeline?',
    answer:
      'No. A sale or closing timeline depends on the property, title, inspections, legal and contractual review, buyer decisions, financing when applicable, and other independent parties. VestBlock records your preferred timing so an operator can review the case responsibly.',
  },
  {
    question: 'What does VestBlock do after I submit?',
    answer:
      'VestBlock organizes the submitted facts, creates an accountable operator task, and reviews whether more information is needed. Any later sale-path conversation remains separate from the intake and depends on the property, seller priorities, legal requirements, and independent participant decisions.',
  },
  {
    question: 'Is VestBlock a real estate agent or buyer?',
    answer:
      'VestBlock is a platform for organizing and reviewing the opportunity. It is not a buyer, lender, title company, inspector, attorney, or closing agent, and it does not guarantee an offer, price, buyer, financing, closing date, sale, or other outcome.',
  },
];

export const buyerFaqs: FaqItem[] = [
  {
    question: 'How do I join the VestBlock buyer network?',
    answer:
      'Share your buy box at vestblock.io/buyers: target markets, asset types, price range, typical closing speed, proof-of-funds status, preferred deal structures, and no-go criteria. VestBlock stores your criteria and introduces better-fit seller opportunities for review.',
  },
  {
    question: 'What is a real estate buy box?',
    answer:
      'A buy box is the set of criteria that defines the deals a buyer actually wants — markets, property types, price range, condition, return targets, and deal structure. A clear buy box lets VestBlock match seller opportunities to the right buyer instead of sending mismatched inventory.',
  },
  {
    question: 'What types of buyers does VestBlock work with?',
    answer:
      'Local cash buyers, fix-and-flip operators, landlords and rental buyers, small and large multifamily investors, land buyers, commercial buyers, institutional buyers, and fund buyers can all share criteria and receive matched opportunities.',
  },
  {
    question: 'Can VestBlock help buyers find funding for deals?',
    answer:
      'VestBlock can help qualified buyers organize a deal for funding review through No Limit Capital or another better-fit capital partner. This can support fix-and-flip, bridge, DSCR, and ground-up construction scenarios, but VestBlock does not lend money or guarantee approvals, terms, leverage, rates, or closings.',
  },
  {
    question: 'Does it cost anything to share my buy box?',
    answer:
      'No. Sharing your buy box is free. VestBlock does not guarantee deal volume, exclusivity, assignments, or closed transactions — the goal is to introduce better-fit opportunities for your review.',
  },
];

export const lenderFaqs: FaqItem[] = [
  {
    question: 'How do lenders join the VestBlock network?',
    answer:
      'Lenders share their lending box at vestblock.io/lenders: states served, loan amount range, preferred deal types, minimum credit or DSCR requirements, and no-go items. VestBlock introduces better-fit real estate borrower and deal opportunities to your team for review.',
  },
  {
    question: 'What types of lenders does VestBlock work with?',
    answer:
      'Private lenders, hard money lenders, DSCR lenders, fix-and-flip lenders, bridge lenders, and commercial capital providers can all share criteria and receive matched borrower and deal opportunities.',
  },
  {
    question: 'How do lender introductions work?',
    answer:
      'When a seller, borrower, or operator opportunity matches your stated lending box, VestBlock can introduce it to your team for review. Introductions are based on your stated criteria, so you see fewer, better-fit conversations instead of unfiltered volume.',
  },
  {
    question: 'Does VestBlock guarantee funded deals or referrals?',
    answer:
      'No. VestBlock is a real estate partner platform, not a borrower or guarantor. It does not promise deal volume, approvals, terms, or closed referrals. The purpose is to keep lender criteria clean so opportunities and partnerships can be handled more clearly.',
  },
];

export const realEstateFundingFaqs: FaqItem[] = [
  {
    question: 'What is real estate funding review at VestBlock?',
    answer:
      'It is a review path where investors share deal details — DSCR rental, fix-and-flip, bridge, hard-money, ground-up construction, or other scenarios — so VestBlock can organize the context and introduce the conversation to better-fit lenders, capital partners, or project partners for review.',
  },
  {
    question: 'What deal types can be reviewed?',
    answer:
      'DSCR rental loans, fix-and-flip projects, bridge financing, hard-money scenarios, ground-up construction projects, and other investor real estate financing situations can be reviewed based on the deal and borrower context. Qualified files may be routed toward No Limit Capital or another better-fit lender for review.',
  },
  {
    question: 'What is the No Limit Capital partner path?',
    answer:
      'No Limit Capital is a VestBlock capital partner path for investor real estate files such as fix-and-flip, bridge, DSCR rental, and ground-up construction scenarios. VestBlock can help organize the deal context, but No Limit Capital determines final eligibility, pricing, terms, leverage, appraisal requirements, and approvals.',
  },
  {
    question: 'Does VestBlock lend money directly or guarantee funding?',
    answer:
      'No. VestBlock does not lend, fund, or guarantee approval, terms, or rates. It reviews deal context and can introduce it to lenders in its network. All lending decisions, terms, and approvals are made by the lender.',
  },
];

export const pricingFaqs: FaqItem[] = [
  {
    question: 'How does VestBlock pricing work?',
    answer:
      'Core real estate paths — seller property review, buyer buy-box intake, lender network signup, and real estate funding review — are free to start. DealVault is a paid product for proof, payout, and milestone records, and supporting services such as AI intake and funding prep are priced separately when they help a deal or member relationship move.',
  },
  {
    question: 'How much does DealVault cost?',
    answer:
      'DealVault offers tiered plans for individuals, teams, and businesses that need agreement proof records, payout ledgers, and milestone tracking. Setup and certificate options are available for higher-touch rollouts. Request a private demo for current pricing and scope.',
  },
  {
    question: 'Are there guarantees on funding, deals, or outcomes?',
    answer:
      'No. VestBlock sells review, records, introductions, and preparation support — not guaranteed funding, deals, closings, approvals, or investment returns. Final outcomes depend on lenders, buyers, underwriting, and your own decisions.',
  },
];
