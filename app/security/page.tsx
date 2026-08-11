import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Security Overview',
  description: 'VestBlock security controls, boundaries, and reporting process.',
};

export default function SecurityPage() {
  return (
    <LegalPage eyebrow="Trust" title="Security overview" updated="August 11, 2026">
      <p>
        VestBlock uses layered technical and operational controls appropriate to the current platform. This page is a transparency summary, not a certification, audit opinion, warranty, or claim of complete security.
      </p>

      <h2>Current controls</h2>
      <ul>
        <li>Supabase authentication, row-level security, service-role separation, and server-derived administrative authorization.</li>
        <li>Same-origin checks for state-changing routes, restrictive browser headers, signed webhook verification, and payment-order binding.</li>
        <li>Approval gates for external sends, publishing, spend, production deployment, payments, contracts, and blockchain writes.</li>
        <li>Sentry error monitoring configured to avoid intentional personal-data capture, plus structured server logs without message bodies or secrets.</li>
        <li>Source provenance, suppression, deduplication, idempotency, and audit records across CRM and outreach workflows.</li>
        <li>Private documents and personal information stay off public blockchains; DealVault anchors only approved non-sensitive proof references.</li>
      </ul>

      <h2>Data and vendor boundaries</h2>
      <p>
        Secrets remain server-side and must never use public environment-variable prefixes. Access is limited by role and purpose. Vercel hosts the application, Supabase stores application records, and approved subprocessors receive only the data required for their functions. Local Obsidian strategy projections exclude leads, addresses, credentials, and communication bodies.
      </p>

      <h2>Incident response</h2>
      <p>
        The operating checklist is: contain access, preserve evidence, rotate affected credentials, assess affected data and people, restore from a known-good state, notify vendors or authorities when required, communicate appropriately, and record corrective actions. Security findings should be sent to <a href="mailto:contact@vestblock.io">contact@vestblock.io</a> with a concise reproduction and no unnecessary personal data.
      </p>
    </LegalPage>
  );
}
