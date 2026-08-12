import type { Metadata } from 'next';

import { DataRightsForm } from '@/components/legal/data-rights-form';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Data Rights',
  description: 'Request access, correction, export, restriction, or deletion of VestBlock account data.',
};

export default function DataRightsPage() {
  return (
    <LegalPage eyebrow="Privacy operations" title="Data rights and retention" updated="August 11, 2026">
      <p>
        VestBlock accepts requests for access, correction, export, restriction, and deletion. We verify identity, record the request, identify affected systems and vendors, preserve legally required records, complete approved actions, and record closure without placing request details in analytics or public logs.
      </p>

      <h2>Current retention schedule</h2>
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Record</th><th>Working retention</th><th>Deletion rule</th></tr></thead>
          <tbody>
            <tr><td>Unconverted inquiry</td><td>24 months after last activity</td><td>Delete or de-identify unless suppression or legal need requires a minimal record.</td></tr>
            <tr><td>Customer, transaction, and tax record</td><td>7 years after the relationship or transaction</td><td>Restrict access, then delete when legal and accounting needs expire.</td></tr>
            <tr><td>Consent, unsubscribe, suppression, and complaint</td><td>As long as needed to honor the preference, normally 7 years</td><td>Keep only the minimum channel hash, scope, reason, and date.</td></tr>
            <tr><td>Outreach content and delivery activity</td><td>24 months after final activity</td><td>Delete message bodies earlier when no longer operationally needed; retain aggregate outcomes.</td></tr>
            <tr><td>Security and audit record</td><td>24 months, longer for an active investigation</td><td>Delete or de-identify after the control or investigation need ends.</td></tr>
            <tr><td>Uploaded document</td><td>During the requested service plus up to 90 days</td><td>Delete the file and derived sensitive text unless the user requests continued storage or law requires retention.</td></tr>
            <tr><td>Strategy and aggregate experiment data</td><td>Up to 5 years</td><td>Keep de-identified aggregates; delete linked personal identifiers under an approved request.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Deletion workflow</h2>
      <ol>
        <li>Verify the requester and scope.</li>
        <li>Pause non-essential outreach and mark the record for review.</li>
        <li>Locate account, CRM, communication, file, payment-reference, analytics, and vendor records.</li>
        <li>Apply legal, fraud, security, tax, dispute, and suppression exceptions narrowly.</li>
        <li>Delete or de-identify eligible records, notify required processors, and verify completion.</li>
        <li>Close the request with a minimal audit record and response to the requester.</li>
      </ol>

      <DataRightsForm />
      <p>Requests may also be sent to <a href="mailto:contact@vestblock.io">contact@vestblock.io</a>.</p>
    </LegalPage>
  );
}
