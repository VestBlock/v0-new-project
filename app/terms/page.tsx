import type { Metadata } from 'next'

import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = { title: 'Terms of Use', description: 'Terms governing access to and use of the VestBlock platform.' }

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Vestblock LLC" title="Terms of Use" updated="August 14, 2026">
      <p>These terms govern access to VestBlock, a platform operated by Vestblock LLC. By using the platform, you agree to these terms and the Privacy Policy. If you use VestBlock for an organization, you represent that you have authority to act for it.</p>

      <h2>Eligibility and accounts</h2>
      <p>You must be at least 18 and legally able to enter an agreement. Provide accurate information, keep credentials secure, and promptly update material changes. You are responsible for activity performed through your account unless you report unauthorized use.</p>

      <h2>What VestBlock provides</h2>
      <p>VestBlock helps people organize capital requests, real-estate needs, opportunities, participant criteria, financial roadmaps, operating resources, and supporting records. Features may include education, intake, analysis, matching, introductions, communications, DealVault records, and VestBlock team review.</p>
      <p>Unless a separate signed agreement expressly says otherwise, VestBlock is not your lender, financial adviser, attorney, accountant, credit bureau, title company, escrow agent, real-estate broker, or fiduciary. A provider&apos;s role, licensing, disclosures, and separate terms control the service that provider offers.</p>

      <h2>No guaranteed outcome</h2>
      <p>An intake, score, roadmap, match, profile, analysis, listing, funding path, introduction, or DealVault record is not a guarantee of approval, credit improvement, funding, price, availability, property condition, return, customer, referral, contract, closing, or other result. Lenders and providers control underwriting, eligibility, rates, fees, leverage, documentation, terms, and final decisions. Buyers, sellers, and other participants make their own transaction decisions and should complete independent diligence.</p>

      <h2>Financial and credit tools</h2>
      <p>Financial roadmaps and credit tools are educational and organizational. They are not individualized legal, tax, investment, or financial advice. Accurate negative credit information generally cannot lawfully be removed simply because it is unfavorable. You may dispute information you believe is inaccurate and can contact consumer reporting companies yourself at little or no cost. Any paid credit-related service is governed by a separate written agreement and applicable cancellation, disclosure, and payment rules.</p>

      <h2>Matching and introductions</h2>
      <p>Matching uses the criteria, permissions, source freshness, and information available at the time. A match indicates possible fit, not verified availability or a promise to transact. Matching permission and outreach permission are separate. VestBlock may pause, defer, correct, or remove a match when information is stale, incomplete, suppressed, disputed, or no longer eligible.</p>

      <h2>Real estate and fair access</h2>
      <p>Users may not use VestBlock to discriminate, steer, exclude, advertise, or make a housing-related decision in violation of fair-housing, fair-lending, civil-rights, licensing, consumer-protection, or other applicable law. Do not submit protected-characteristic targeting instructions. Property, title, condition, value, zoning, taxes, liens, occupancy, and public-record information may be incomplete or outdated and must be independently verified.</p>

      <h2>AI-assisted features</h2>
      <p>AI may organize submitted information or propose language, criteria, matches, or next steps. AI can make mistakes. Review output before relying on it. Untrusted news or third-party content cannot directly authorize an external action, and material strategy changes require human review.</p>

      <h2>Communications</h2>
      <p>You may receive transactional messages related to an account, request, case, security event, or relationship. Marketing messages remain subject to the permissions and opt-out controls presented to you. You may unsubscribe from marketing without closing your account. Consent to marketing is not a condition of receiving a requested analysis unless stated for a specific optional service.</p>

      <h2>DealVault and user records</h2>
      <p>DealVault can preserve records, versions, milestones, permissions, proofs, or payout context. It does not replace a signed contract, title record, escrow instruction, legal filing, or independent verification. You retain responsibility for the accuracy, authority, legality, and confidentiality of material you submit.</p>

      <h2>Acceptable use</h2>
      <p>Do not use VestBlock to break the law; impersonate another person; submit information you lack authority to share; mislead customers or providers; evade suppression or consent controls; scrape private information; target protected classes; distribute malware; probe security; interfere with the platform; or automate external outreach outside approved controls. We may restrict or suspend activity reasonably believed to create risk.</p>

      <h2>Third-party services</h2>
      <p>Third-party providers and linked services have their own terms, privacy practices, qualifications, and availability. VestBlock is not responsible for a third party&apos;s independent decision or service. Review their terms before proceeding.</p>

      <h2>Intellectual property</h2>
      <p>VestBlock and its platform materials are owned by Vestblock LLC or its licensors. You receive a limited, revocable, non-transferable right to use the platform for its intended purpose. You retain rights in material you submit and grant Vestblock LLC permission to host, process, reproduce, and share it only as needed to provide the requested service, follow your permissions, secure the platform, and comply with law.</p>

      <h2>Service availability and changes</h2>
      <p>We may update, suspend, or discontinue a feature to maintain security, comply with requirements, address provider changes, or improve the service. We do not promise uninterrupted or error-free operation.</p>

      <h2>Disclaimers and limitation</h2>
      <p>To the extent permitted by law, VestBlock is provided “as is” and “as available,” without implied warranties of merchantability, fitness for a particular purpose, noninfringement, or a guaranteed outcome. To the extent permitted by law, Vestblock LLC is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, opportunities, data, goodwill, financing, or transactions arising from use of the platform.</p>
      <p>Some jurisdictions do not allow certain warranty exclusions or liability limits, so part of this section may not apply to you. Nothing in these terms waives a right that cannot lawfully be waived.</p>

      <h2>Termination and disputes</h2>
      <p>You may stop using VestBlock. We may suspend or terminate access for material breach, security risk, unlawful use, or nonpayment under a separate paid agreement. Provisions that reasonably need to continue—such as ownership, record integrity, disclaimers, limitations, and dispute terms—survive termination. Before filing a claim, contact <a href="mailto:contact@vestblock.io">contact@vestblock.io</a> so the parties can try to resolve the issue informally. Applicable law governs any dispute unless a separate signed agreement states otherwise.</p>

      <h2>Changes and contact</h2>
      <p>We may update these terms as the platform or applicable requirements change. Continued use after an effective update means you accept the revised terms. Contact <a href="mailto:contact@vestblock.io">contact@vestblock.io</a> with questions.</p>
    </LegalPage>
  )
}
