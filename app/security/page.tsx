import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

export const metadata: Metadata = {
  title: 'Security',
  description: 'VestBlock LLC security practices and responsible disclosure contact.',
  alternates: { canonical: '/security' },
};

export default function SecurityPage() {
  return (
    <LegalPageShell
      eyebrow="Trust"
      title="Security at VestBlock"
      summary="VestBlock uses layered controls for accounts, data, provider access, outbound communications, and production changes."
    >
      <section>
        <h2>Current controls</h2>
        <ul>
          <li>Encrypted HTTPS connections for the public site and authenticated application traffic.</li>
          <li>Server-side session checks and role checks for protected account, admin, and diagnostic routes.</li>
          <li>Same-origin checks for protected state-changing requests and no-index rules for private surfaces.</li>
          <li>Secret storage outside the browser bundle, signed webhook checks, and restricted service credentials.</li>
          <li>Database access policies, scoped service access, audit records, and recovery-safe job claims.</li>
          <li>Suppression, reply-capture, identity, mailing-address, idempotency, and delivery-health gates for automated outreach.</li>
          <li>Dependency, type, build, and browser checks before a production release.</li>
        </ul>
      </section>

      <section>
        <h2>Limits</h2>
        <p>
          Security controls reduce risk but cannot remove it. Keep your password unique, protect access to your email account, sign out on shared devices, and report unexpected account activity promptly. VestBlock will never ask you to email a password, private key, or full payment-card number.
        </p>
      </section>

      <section>
        <h2>Responsible disclosure</h2>
        <p>
          If you believe you found a security issue, email <a href="mailto:acquisitions@vestblock.io">acquisitions@vestblock.io</a> with “Security report” in the subject line. Include the affected URL, a concise reproduction, and the impact. Do not access another person’s data, disrupt the service, use social engineering, or publish the issue before VestBlock has had a reasonable chance to investigate.
        </p>
      </section>

      <section>
        <h2>Incident response</h2>
        <p>
          VestBlock investigates credible reports, limits access when needed, preserves relevant records, fixes confirmed issues, and provides notices when applicable law requires them. Response time depends on severity and the information available to reproduce the issue.
        </p>
      </section>
    </LegalPageShell>
  );
}
