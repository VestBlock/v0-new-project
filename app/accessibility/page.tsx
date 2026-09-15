import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

export const metadata: Metadata = {
  title: 'Accessibility',
  description: 'VestBlock LLC accessibility commitment and support contact.',
  alternates: { canonical: '/accessibility' },
};

export default function AccessibilityPage() {
  return (
    <LegalPageShell
      eyebrow="Access"
      title="Accessibility"
      summary="VestBlock is working to make its public site and core workflows usable across devices, input methods, and motion preferences."
    >
      <section>
        <h2>What we test</h2>
        <p>
          Release checks cover keyboard navigation, visible focus, semantic page landmarks, text contrast, responsive layouts, horizontal overflow, reduced-motion behavior, form labels, and common browser errors. We correct confirmed barriers as part of product maintenance.
        </p>
      </section>

      <section>
        <h2>Request help or report a barrier</h2>
        <p>
          If a page, document, questionnaire, or account workflow is hard to use, email <a href="mailto:acquisitions@vestblock.io">acquisitions@vestblock.io</a> with “Accessibility” in the subject line. Include the page URL, the device or assistive technology used, and the task you were trying to complete. You may also ask for the information in another reasonable format.
        </p>
      </section>
    </LegalPageShell>
  );
}
