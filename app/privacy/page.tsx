import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Vestblock LLC collects, uses, protects, and deletes information in VestBlock.',
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Trust" title="Privacy Policy" updated="August 11, 2026">
      <p>
        This policy explains how Vestblock LLC ("VestBlock," "we," "us") handles information when you use VestBlock websites, applications, forms, communications, and services.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account and contact information you provide, such as your name, email, phone number, role, and organization.</li>
        <li>Business, funding, property, buyer, lender, partner, and opportunity information submitted for a requested review or service.</li>
        <li>Consent, channel preference, unsubscribe, suppression, communication, meeting, task, and outcome records needed to operate our CRM.</li>
        <li>Payment status and transaction references supplied by PayPal. VestBlock does not store full payment-card credentials.</li>
        <li>Limited technical data needed for security, reliability, and anonymous traffic measurement.</li>
      </ul>

      <h2>Analytics and cookies</h2>
      <p>
        VestBlock uses privacy-minimal Vercel Web Analytics for anonymous page and performance measurement and Sentry for error monitoring. We do not use session replay. Authentication and security features may use essential local storage or cookies. We do not use advertising cookies through this implementation unless the policy and consent controls are updated first.
      </p>

      <h2>How we use information</h2>
      <p>
        We use information to authenticate users, respond to requests, prepare or deliver selected services, maintain opportunity and partner records, route approved introductions, prevent duplicate or unwanted outreach, process payments, improve measured strategies, protect VestBlock, and comply with applicable obligations. Automated tools may classify, summarize, or draft work, but authority to send prospect outreach, spend, publish, charge, sign, or deploy remains approval-gated.
      </p>

      <h2>Sources and sharing</h2>
      <p>
        Information may come from you, an authorized partner, VestBlock CRM activity, or a documented lawful public source. We share only what is necessary with service providers or an approved partner for the requested purpose. Current core subprocessors include Vercel, Supabase, OpenAI, Microsoft, Resend, n8n, Buffer, Sentry, and PayPal. Partner-specific sharing is subject to purpose, permission, and review.
      </p>

      <h2>Data minimization, security, and retention</h2>
      <p>
        VestBlock limits sensitive data in URLs, logs, analytics, and local strategy notes. Access controls, row-level security, audit records, webhook verification, encryption provided by our vendors, suppression controls, and approval gates reduce risk. No system is completely secure. Retention depends on the record and legal or operational need; the current schedule is published on the <Link href="/data-rights">data-rights page</Link>.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You may opt out of marketing messages at any time. Transactional messages related to an active request may still be sent when necessary. Depending on where you live, you may request access, correction, export, deletion, restriction, or information about sharing. Submit a request through the <Link href="/data-rights">data-rights process</Link> or email <a href="mailto:contact@vestblock.io">contact@vestblock.io</a>. We will verify identity before disclosing or deleting account data.
      </p>

      <h2>Children and changes</h2>
      <p>
        VestBlock is intended for adults and business users, not children under 13. We may update this policy when our practices change and will post the new date here. Material changes may also be communicated through the platform or an appropriate channel.
      </p>
    </LegalPage>
  );
}
