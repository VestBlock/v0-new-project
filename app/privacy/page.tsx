import type { Metadata } from 'next'

import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = { title: 'Privacy Policy', description: 'How VestBlock collects, uses, shares, and protects personal information.' }

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Vestblock LLC" title="Privacy Policy" updated="August 14, 2026">
      <p>This policy explains how Vestblock LLC, operating the VestBlock platform, handles personal information when you visit our website, create an account, complete a questionnaire, submit a property or funding request, create a participant profile, communicate with us, or use another VestBlock feature.</p>

      <h2>Information we collect</h2>
      <p>We collect information you provide, information created through your use of the platform, and limited information from approved third-party or public sources.</p>
      <ul>
        <li><strong>Account and contact information:</strong> name, email address, phone number, organization, account preferences, and authentication records.</li>
        <li><strong>Requests and criteria:</strong> business, funding, property, buyer, lender, provider, opportunity, and financial-roadmap information you choose to submit.</li>
        <li><strong>Documents and communications:</strong> files, messages, support requests, and operator notes connected to your request. Do not put passwords, full account numbers, or Social Security numbers into free-text forms.</li>
        <li><strong>Consent and activity records:</strong> the permissions you select, profile and case status, review history, suppression choices, delivery events, and security logs.</li>
        <li><strong>Technical information:</strong> browser, device, IP address, referral page, and similar records needed to operate, secure, and understand the service.</li>
        <li><strong>Approved external information:</strong> public property records, provider-supplied criteria, delivery status, and other time-stamped information an operator has approved for a defined platform use.</li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>Provide accounts, questionnaires, roadmaps, case management, DealVault records, and customer support.</li>
        <li>Organize and review requests, criteria, documents, and possible next steps.</li>
        <li>Generate AI-assisted analyses or proposals for customer or VestBlock team review.</li>
        <li>Run matching only for active, eligible profiles with matching permission. Matching permission does not authorize outreach.</li>
        <li>Send account or requested communications and, where permitted, marketing messages. We honor suppression and unsubscribe choices.</li>
        <li>Detect abuse, prevent duplicate actions, protect accounts, keep audit history, and comply with applicable obligations.</li>
        <li>Measure and improve platform reliability, accessibility, customer journeys, and approved strategies without inventing customer or performance results.</li>
      </ul>

      <h2>AI-assisted processing</h2>
      <p>VestBlock may use artificial intelligence to organize information, draft a roadmap, identify missing details, classify a reply, or propose a strategy or match. AI output can be incomplete or wrong. It does not make a lender&apos;s underwriting decision, guarantee an opportunity, silently change an active strategy, or authorize external outreach. Material decisions remain subject to the applicable customer, provider, or VestBlock team review.</p>

      <h2>When we share information</h2>
      <p>We may share information with service providers that help us host, secure, communicate, analyze, and operate VestBlock; with a lender, buyer, seller, professional, or other provider when you request or permit the applicable route; with professional advisers; or when disclosure is required to protect rights, safety, or comply with law. Service providers are limited to the information needed for their assigned function.</p>
      <p>Current platform providers may include Vercel, Supabase, OpenAI, Microsoft, Resend, and n8n. VestBlock-owned social channels may use Buffer for approved publishing; private customer records are not social-post content. We do not use Twilio, Postiz, or PostHog in the current platform release.</p>
      <p>VestBlock does not sell personal information for money. If our practices change in a way that creates additional legal choices, we will update this policy and provide the required controls.</p>

      <h2>Retention and deletion</h2>
      <p>We keep information for the time reasonably needed to provide the service, maintain security and audit history, resolve disputes, enforce agreements, and meet applicable requirements. Retention varies by record type and relationship. Some records may remain after account closure where required for fraud prevention, legal obligations, or documented transaction history.</p>

      <h2>Your choices</h2>
      <p>You may update account information, manage a participant profile, change matching, outreach, marketing, or public-display permission, use a secure management link where provided, unsubscribe from marketing, or request access, correction, or deletion. Revoking one permission does not automatically revoke a separate permission. We may need to verify your identity before completing a request.</p>
      <p>Send privacy requests to <a href="mailto:contact@vestblock.io">contact@vestblock.io</a>. Include enough detail for us to identify the relevant account or record, but do not email passwords, Social Security numbers, or full financial-account numbers.</p>

      <h2>Security</h2>
      <p>We use access controls, restricted database permissions, encrypted transport, validation, rate limits, audit records, and service-provider controls designed to protect information. No system can guarantee absolute security. Tell us promptly if you believe an account or record has been compromised.</p>

      <h2>Children and location</h2>
      <p>VestBlock is intended for adults and is not directed to children under 18. The platform is operated from the United States. Information may be processed where our approved service providers operate, subject to their safeguards and applicable requirements.</p>

      <h2>Policy changes and questions</h2>
      <p>We may update this policy as the platform, providers, or legal requirements change. The date above identifies the current version. Material changes will receive notice appropriate to the change. Questions may be sent to <a href="mailto:contact@vestblock.io">contact@vestblock.io</a>.</p>
    </LegalPage>
  )
}
