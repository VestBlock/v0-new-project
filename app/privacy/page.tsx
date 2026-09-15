import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How VestBlock LLC collects, uses, shares, and protects personal information.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy"
      title="Privacy policy"
      summary="This policy explains what VestBlock collects, why we use it, when service providers receive it, and the choices available to you."
    >
      <section>
        <h2>Scope</h2>
        <p>
          This policy applies to VestBlock LLC websites, questionnaires, workspaces, communications, and related services. It does not control an independent lender, buyer, seller, payment processor, credit bureau, or other third party that publishes its own policy.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Account and contact details, including your name, email address, phone number, and sign-in records.</li>
          <li>Information you submit about a business, funding goal, property, buyer criteria, lender criteria, credit goal, or requested roadmap.</li>
          <li>Documents and records you choose to upload, which may contain financial, property, identity, or credit-related information.</li>
          <li>Messages, form responses, support requests, consent records, and communication preferences.</li>
          <li>Device, browser, security, referral, and usage data needed to operate, protect, and improve the site.</li>
          <li>Business contact and public-record information used for lawful business development, property research, relationship routing, and suppression checks.</li>
        </ul>
        <p>
          Payment providers process payment credentials under their own terms. VestBlock does not need your full payment-card number to maintain your account record.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>Provide questionnaires, analyses, roadmaps, account features, and requested support.</li>
          <li>Review readiness and route a request to a relevant VestBlock workflow or independent provider.</li>
          <li>Match property, buyer, lender, capital, and service criteria when a user asks us to make that connection.</li>
          <li>Send transactional messages and permitted business communications, record replies, and honor opt-out or do-not-contact requests.</li>
          <li>Prevent fraud, secure accounts, diagnose failures, measure service performance, and meet legal obligations.</li>
          <li>Improve recommendations from completed workflows, provider outcomes, and feedback. Automated output remains subject to the limits described in our terms.</li>
        </ul>
      </section>

      <section>
        <h2>AI-assisted processing</h2>
        <p>
          Some VestBlock features use contracted AI and infrastructure providers to return an analysis, draft, classification, or roadmap. We send only the inputs needed for that task and apply access controls to the resulting record. Do not upload information you are not authorized to share.
        </p>
      </section>

      <section>
        <h2>When information is shared</h2>
        <p>We may share information with:</p>
        <ul>
          <li>Hosting, database, email, payment, analytics, document, security, and AI service providers working for VestBlock.</li>
          <li>A lender, buyer, seller, contractor, advisor, or other partner when you request a match, introduction, review, or transaction workflow.</li>
          <li>Authorities or professional advisers when disclosure is required by law or reasonably needed to protect people, accounts, or property.</li>
          <li>A successor in a merger, financing, reorganization, or sale, subject to applicable confidentiality requirements.</li>
        </ul>
        <p>
          VestBlock does not sell personal information for money. Advertising and measurement tools may qualify as a sale or sharing under some state laws. You may contact us to request an applicable opt-out.
        </p>
      </section>

      <section>
        <h2>Retention and protection</h2>
        <p>
          We keep information while an account or workflow is active and as needed for transaction records, security, dispute resolution, suppression lists, and legal duties. Retention periods vary by record type. We use technical and organizational controls designed to protect information, but no online service can promise absolute security.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can unsubscribe from non-transactional email through the message link or ask us to stop contacting you. Depending on where you live, you may also request access, correction, deletion, a portable copy, or an opt-out from certain processing. We may need to verify your identity and may retain records when law, security, or a suppression obligation requires it.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Send privacy questions or requests to <a href="mailto:acquisitions@vestblock.io">acquisitions@vestblock.io</a>. Put “Privacy request” in the subject line and do not send a Social Security number, password, or full payment-card number by email.
        </p>
      </section>
    </LegalPageShell>
  );
}
