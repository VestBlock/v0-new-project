import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms that apply when you access or use VestBlock LLC services.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms"
      title="Terms of use"
      summary="These terms govern access to VestBlock websites, questionnaires, workspaces, analyses, introductions, and related services."
    >
      <section>
        <h2>Agreement and eligibility</h2>
        <p>
          By using VestBlock, you agree to these terms and the privacy policy. You must be at least 18 and legally able to enter an agreement. If you act for a company or another person, you confirm that you have authority to do so.
        </p>
      </section>

      <section>
        <h2>What VestBlock provides</h2>
        <p>
          VestBlock organizes information, produces educational analyses and roadmaps, routes workflows, and may introduce users to independent providers or counterparties. Features and eligibility can change as the platform, law, provider criteria, and available data change.
        </p>
      </section>

      <section>
        <h2>Important financial, credit, and real-estate limits</h2>
        <ul>
          <li>VestBlock is not a bank, credit bureau, law firm, accounting firm, or government agency.</li>
          <li>Unless a specific written agreement says otherwise, VestBlock is not acting as your lender, broker, fiduciary, real-estate agent, or investment adviser.</li>
          <li>Analyses, scores, scenarios, property estimates, and AI output are educational decision support. They can be incomplete or wrong and require independent verification.</li>
          <li>No result guarantees funding, credit improvement, an offer, a sale, a closing date, a return, or acceptance by an independent provider.</li>
          <li>Independent providers set their own underwriting, pricing, eligibility, licensing, privacy, and transaction terms.</li>
        </ul>
        <p>
          You remain responsible for professional advice, due diligence, contracts, disclosures, taxes, title, property condition, licensing, and any decision made from platform output.
        </p>
      </section>

      <section>
        <h2>Your account and submissions</h2>
        <p>
          Provide accurate information, keep sign-in credentials secure, and update material changes. You must have permission to submit every document, contact, property, business, and data record you provide. You keep ownership of your content and grant VestBlock the limited right to process it to provide, secure, and improve the requested service.
        </p>
      </section>

      <section>
        <h2>Communications</h2>
        <p>
          You agree to receive service messages needed for your account or requested workflow. Marketing and business-development email must include an available opt-out, and VestBlock records suppression requests. Consent to receive marketing is not a condition of purchase. Carrier message and data rates may apply to any SMS feature you separately request.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You may not:</p>
        <ul>
          <li>Break the law, misrepresent identity or authority, or submit information you lack permission to use.</li>
          <li>Probe, bypass, overload, reverse engineer, or interfere with security, access controls, rate limits, or another user’s account.</li>
          <li>Use VestBlock output for unlawful discrimination, deceptive outreach, harassment, fraud, or an unlicensed regulated activity.</li>
          <li>Copy, resell, or automate access to the service except through a written agreement or an approved integration.</li>
        </ul>
      </section>

      <section>
        <h2>Third-party services</h2>
        <p>
          VestBlock connects to independent platforms and providers. Their availability, decisions, content, security, and terms remain outside VestBlock’s control. A link, match, or introduction is not an endorsement or guarantee.
        </p>
      </section>

      <section>
        <h2>Fees, changes, and termination</h2>
        <p>
          Paid terms shown at checkout or in a signed agreement control the applicable price, renewal, and cancellation rules. You may stop using the service at any time. VestBlock may restrict or end access for nonpayment, misuse, legal risk, security risk, or a material breach. Terms may change prospectively; the updated date will appear on this page.
        </p>
      </section>

      <section>
        <h2>Disclaimers and liability</h2>
        <p>
          To the extent allowed by law, the service is provided as available and without warranties that a specific result will occur. VestBlock is not liable for an independent provider’s decision or conduct, user-submitted errors, or indirect, special, incidental, punitive, or consequential damages. Rights that cannot legally be waived remain in effect.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to <a href="mailto:acquisitions@vestblock.io">acquisitions@vestblock.io</a> with “Terms question” in the subject line.
        </p>
      </section>
    </LegalPageShell>
  );
}
