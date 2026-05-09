// lib/letters/templates.tsx
import * as React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { NegativeItem } from '../extract-negative-items';
// import { NegativeItem } from './extract-negative-items';

export type LetterBureau = 'Experian' | 'Equifax' | 'TransUnion';
export type LetterType =
  | '609'
  | 'Debt Validation'
  | 'Incorrect Information'
  | 'Cease & Desist'
  | 'Direct Furnisher Dispute'
  | 'Method Of Verification'
  | 'Statement Of Dispute'
  | 'Identity Theft Block'
  | 'Mixed File'
  | 'Outdated Information'
  | 'Personal Information Correction';

// Keep this aligned with your NegativeItem shape.
// We only read a few optional fields below.
export type LetterItem = {
  creditor?: string;
  account_type?: string;
  account_last4?: string;
  reason?: string;
  // ...other fields you already pass through
};

function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatItemLine(it: LetterItem, idx: number): string {
  const name = it.creditor || it.account_type || 'Account';
  const last4 = it.account_last4 ? ` ****${esc(it.account_last4)}` : '';
  const reason = it.reason ? ` — ${esc(it.reason)}` : '';
  return `<li><strong>${esc(name)}</strong>${last4}${reason}</li>`;
}

export type LetterPayload = {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  dateISO: string;
  bureau: 'Experian' | 'Equifax' | 'TransUnion';
  letterType:
    | '609'
    | 'Debt Validation'
    | 'Incorrect Information'
    | 'Cease & Desist'
    | 'Direct Furnisher Dispute'
    | 'Method Of Verification'
    | 'Statement Of Dispute'
    | 'Identity Theft Block'
    | 'Mixed File'
    | 'Outdated Information'
    | 'Personal Information Correction';
  items: NegativeItem[];
  bodyHtml?: string;
};

export function letterHtml(payload: LetterPayload) {
  const {
    fullName,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
    bureau,
    letterType,
    items,
    dateISO,
    bodyHtml,
  } = payload;

  const bodySection =
    bodyHtml && bodyHtml.trim().length > 0
      ? bodyHtml
      : defaultBodyHtml(bureau, letterType, items || []);

  return `<!doctype html>
<html lang="en">
<body>
  <div class="letter">
    <div class="header">
      <div class="meta">
        Date: ${esc(dateISO)}<br/>
        Bureau: ${esc(bureau)}<br/>
        Letter Type: ${esc(letterType)}
      </div>
    </div>

    <h1>${esc(letterType)} Dispute Letter – ${esc(bureau)}</h1>

    ${bodySection}

    <div class="signature">
      <p>Sincerely,</p>
      <p><strong>${esc(fullName)}</strong></p>
    </div>

  </div>
</body>
</html>`;
}

function defaultBodyHtml(
  bureau: LetterBureau,
  letterType: LetterType,
  items: LetterItem[]
): string {
  const hasItems = Array.isArray(items) && items.length > 0;
  const itemsList = hasItems
    ? `<ol class="items-list">${items.map(formatItemLine).join('')}</ol>`
    : `<p>No specific entries were detected in the uploaded report. Please conduct a full reinvestigation.</p>`;

  const openingByType: Record<LetterType, string> = {
    '609':
      'I am writing to dispute entries in my credit file that I believe are inaccurate, incomplete, or unverifiable. Under the Fair Credit Reporting Act, please reinvestigate the items listed below and remove or correct any information that cannot be verified.',
    'Debt Validation':
      'I am writing to dispute collector-related information that I believe requires validation. Please review the items below and verify the basis, ownership, and accuracy of the reported information.',
    'Incorrect Information':
      'I am writing to dispute entries in my credit file that I believe are inaccurate, incomplete, or unverifiable. Please reinvestigate the items listed below and correct any information that does not match your records.',
    'Cease & Desist':
      'I am writing to document my dispute and request that all future communication related to the items below be handled in writing. Please review the reporting carefully and update the file if the information cannot be verified.',
    'Direct Furnisher Dispute':
      'I am writing to dispute information that appears to have been furnished inaccurately. Please conduct a reasonable investigation of the reporting source details below and correct any balance, status, date, ownership, or payment-history information that is inaccurate or incomplete.',
    'Method Of Verification':
      'I am writing as a follow-up to a prior dispute result. Please provide the method of verification used for the items below, including the furnisher information relied upon during the investigation, and correct or delete anything that cannot be substantiated.',
    'Statement Of Dispute':
      'I am writing to document that I continue to dispute the items below. If this dispute is not otherwise resolved, please add a brief statement of dispute to my file and ensure it is included or summarized in future reports as required.',
    'Identity Theft Block':
      'I am writing to report information that resulted from identity theft or unauthorized activity. Please review the items below, block reporting where appropriate, and update the file based on the supporting documentation I have provided.',
    'Mixed File':
      'I am writing to dispute information in my file that appears to belong to another person or to a mixed file. Please separate any incorrect personal identifiers or account information from my report and delete information that is not mine.',
    'Outdated Information':
      'I am writing to dispute information that appears to be reported beyond the normal reporting period or with inaccurate dates. Please review the timeline for each item below and remove or correct anything that should no longer appear.',
    'Personal Information Correction':
      'I am writing to dispute inaccurate personal identifying information in my file. Please correct any wrong names, addresses, employers, or other identifying details and review any related accounts that may be attached to those errors.',
  };

  const requestedActionsByType: Record<LetterType, string[]> = {
    '609': [
      'Conduct a reasonable reinvestigation and delete or correct any unverified or inaccurate information.',
      'Provide the method of verification, including the furnisher’s name and address, upon completion.',
      'Send me an updated copy of my credit report reflecting the results of your investigation.',
    ],
    'Debt Validation': [
      'Verify the collector-related information and the basis for the reporting.',
      'Delete or correct any information that cannot be validated or is reported inaccurately.',
      'Send me a written response describing the results of your review.',
    ],
    'Incorrect Information': [
      'Conduct a reasonable reinvestigation and delete or correct any unverified or inaccurate information.',
      'Provide the source used to verify the disputed reporting, if applicable.',
      'Send me an updated copy of my credit report reflecting the results of your investigation.',
    ],
    'Cease & Desist': [
      'Note that I prefer written communication related to the disputed reporting.',
      'Review the underlying reporting for accuracy and completeness.',
      'Send me a written response reflecting the results of your review.',
    ],
    'Direct Furnisher Dispute': [
      'Conduct a reasonable investigation of the reported balances, dates, status, and ownership details.',
      'Correct or delete any information that is inaccurate, incomplete, or cannot be substantiated.',
      'Send me a written explanation of the investigation results.',
    ],
    'Method Of Verification': [
      'Provide the method of verification used for each disputed item.',
      'Identify the furnisher or source used to verify the information.',
      'Correct or delete any reporting that still cannot be substantiated after review.',
    ],
    'Statement Of Dispute': [
      'Review the disputed reporting again for accuracy and completeness.',
      'If the dispute remains unresolved, add a brief statement of dispute to my file.',
      'Confirm in writing how the dispute notation will appear in future reports.',
    ],
    'Identity Theft Block': [
      'Review the disputed information as potential identity-theft related reporting.',
      'Block or remove any information tied to unauthorized accounts or activity when supported.',
      'Confirm the results of your review in writing and send an updated report if changes are made.',
    ],
    'Mixed File': [
      'Review whether the file contains mixed or merged information belonging to another person.',
      'Delete or separate any incorrect personal identifiers or accounts not associated with me.',
      'Send me a corrected report after the reinvestigation is complete.',
    ],
    'Outdated Information': [
      'Review the reporting timeline and delete information that should no longer appear.',
      'Correct any date fields that are inaccurate or misleading.',
      'Send me an updated copy of my credit report reflecting the results.',
    ],
    'Personal Information Correction': [
      'Correct inaccurate personal identifying information in my file.',
      'Review whether the incorrect identifiers caused unrelated accounts or addresses to be associated with me.',
      'Send me an updated report once the corrections are complete.',
    ],
  };

  return `
    <p>Dear ${esc(bureau)} Disputes Department,</p>
    <p>
      ${esc(openingByType[letterType])}
    </p>

    <h3>Items in Dispute</h3>
    ${itemsList}

    <h3>Requested Actions</h3>
    <ul>
      ${requestedActionsByType[letterType]
        .map((action) => `<li>${esc(action)}</li>`)
        .join('')}
    </ul>

    <p>
      Please complete your reinvestigation and provide a written response within the time period
      required by law. If you require additional information, contact me in writing.
    </p>
  `;
}

// Minimal React-PDF version for saving to PDF:
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 12, fontFamily: 'Times-Roman' },
  h2: { fontSize: 16, marginBottom: 8, marginTop: 12 },
});

const LetterPdfDoc = ({ htmlless }: { htmlless: string }) => {
  // Very simple flow: render plain text (safe + robust on server).
  // If you want full HTML fidelity, switch to "react-pdf-html" or headless-chrome later.
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View>
          <Text>{htmlless.replace(/<[^>]+>/g, '')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export { LetterPdfDoc };
