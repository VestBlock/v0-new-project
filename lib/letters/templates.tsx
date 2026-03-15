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
  | 'Cease & Desist';

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
    | 'Cease & Desist';
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

  // A concise, legally-safe default body that works for all 4 types
  return `
    <p>Dear ${esc(bureau)} Disputes Department,</p>
    <p>
      I am writing to dispute entries in my credit file that I believe are inaccurate,
      incomplete, or unverifiable. Under the Fair Credit Reporting Act (15 U.S.C. §1681i),
      please reinvestigate the items listed below and remove or correct any information
      that cannot be verified.
    </p>

    <h3>Items in Dispute</h3>
    ${itemsList}

    <h3>Requested Actions</h3>
    <ul>
      <li>Conduct a reasonable reinvestigation and delete or correct any unverified or inaccurate information.</li>
      <li>Provide the method of verification, including the furnisher’s name and address, upon completion.</li>
      <li>Send me an updated copy of my credit report reflecting the results of your investigation.</li>
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
