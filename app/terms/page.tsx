import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms governing use of VestBlock services and DealVault.',
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Trust" title="Terms of Use" updated="August 11, 2026">
      <p>These terms govern your use of products, websites, applications, communications, and services provided by Vestblock LLC under the VestBlock brand.</p>

      <h2>What VestBlock provides</h2>
      <p>
        VestBlock helps people and businesses organize capital requests, property and partner opportunities, practical resources, analysis, introductions, and DealVault records. Features may use automated analysis or drafting. You remain responsible for reviewing information and making decisions.
      </p>

      <h2>No guaranteed outcome or regulated-service substitution</h2>
      <p>
        VestBlock does not guarantee funding, rates, credit limits, grants, rankings, leads, property value, offers, closings, investment returns, partner performance, or legal outcomes. Unless expressly stated in a separate written agreement, VestBlock is not acting as a lender, broker, buyer, title company, escrow agent, attorney, accountant, financial adviser, or investment adviser. Third parties make their own eligibility, underwriting, pricing, licensing, contracting, and performance decisions.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Provide information you are authorized to share and keep it accurate.</li>
        <li>Use VestBlock lawfully and respect privacy, consent, intellectual-property, licensing, fair-housing, outreach, and platform rules.</li>
        <li>Do not upload malicious code, evade controls, misrepresent identity or authority, or use the platform to pressure, deceive, discriminate against, or harm another person.</li>
        <li>Review contracts, financial obligations, property facts, partner qualifications, and professional advice before acting.</li>
      </ul>

      <h2>DealVault</h2>
      <p>
        DealVault organizes private records and may anchor limited hashes, identifiers, timestamps, or statuses. It does not replace a signed agreement, counsel, title, escrow, custody, or a required regulated process. Do not place private documents, personal details, or raw property addresses on a public blockchain.
      </p>

      <h2>Payments, partners, and communications</h2>
      <p>
        Prices, deliverables, recurring terms, success fees, and refund rules are the ones shown or agreed to at purchase. VestBlock may receive disclosed referral or service compensation. By requesting contact, you authorize a response about that request. Marketing email requires an applicable permission or lawful basis, and SMS requires verified consent; opt-outs and suppressions are honored.
      </p>

      <h2>Accounts, content, and availability</h2>
      <p>
        Keep credentials secure and notify us of suspected misuse. You retain rights in content you submit and grant VestBlock the limited permission needed to process it for the requested service. VestBlock materials and software remain protected by applicable intellectual-property law. Features may change, pause, or be withdrawn, and availability is not guaranteed.
      </p>

      <h2>Disclaimers and limits</h2>
      <p>
        VestBlock is provided on an "as available" basis to the extent permitted by law. We are not responsible for third-party decisions, services, sites, data errors, or events outside our reasonable control. Any liability limitations, dispute terms, governing law, and business-specific provisions should be finalized by counsel before these terms are treated as the definitive customer agreement.
      </p>

      <h2>Contact</h2>
      <p>Questions may be sent to <a href="mailto:contact@vestblock.io">contact@vestblock.io</a>.</p>
    </LegalPage>
  );
}
