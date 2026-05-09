import type { NegativeItem } from '@/lib/extract-negative-items';
import type { LetterType } from '@/lib/letters/templates';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getInitialDisputeLetterAutomationFields,
  notifyDisputeLettersReady,
} from '@/lib/workflows/disputeLetterAutomation';
import {
  attachAnalysisResult,
  attachDisputeLetters,
  attachExtractedText,
  markCreditReportFailed,
  updateCreditReportStatus,
} from '@/lib/workflows/creditRepairWorkflow';

type Bureau = NegativeItem['bureaus'][number];

export type ProcessCreditReportAnalysisInput = {
  reportId: string;
  userId: string;
  userEmail?: string | null;
  username?: string | null;
  fileBuffer: ArrayBuffer | Buffer;
  fileType: string;
  sourceReportPath: string;
};

function groupNegativeItems(items: NegativeItem[]) {
  const grouped: Record<string, NegativeItem[]> = {};

  for (const item of items) {
    for (const bureau of item.bureaus) {
      const key = `${bureau}::${item.suggested_letter_type}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }
  }

  return grouped;
}

function isPdf(fileType: string, sourceReportPath: string) {
  return (
    fileType === 'application/pdf' ||
    sourceReportPath.toLowerCase().endsWith('.pdf')
  );
}

export async function processCreditReportAnalysis({
  reportId,
  userId,
  userEmail,
  username,
  fileBuffer,
  fileType,
  sourceReportPath,
}: ProcessCreditReportAnalysisInput) {
  const [{ htmlToPdfBuffer }, extractMod, { letterHtml }] = await Promise.all([
    import('@/lib/letters/render'),
    import('@/lib/extract-negative-items'),
    import('@/lib/letters/templates'),
  ]);

  const { extractNegativeItemsFromText, extractTextFromPdf, ocrImageToText } =
    extractMod;

  await updateCreditReportStatus(reportId, 'extracting_text');

  try {
    const reportText = isPdf(fileType, sourceReportPath)
      ? await extractTextFromPdf(fileBuffer)
      : await ocrImageToText(fileBuffer);

    if (reportText) {
      await attachExtractedText(reportId, reportText);
    }

    await updateCreditReportStatus(reportId, 'analyzing');

    const items = reportText
      ? await extractNegativeItemsFromText(reportText)
      : [];
    const grouped = groupNegativeItems(items);
    const generatedLetterTypes = Array.from(
      new Set(items.map((item) => item.suggested_letter_type).filter(Boolean))
    );

    const supabase = createAdminClient();
    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('full_name,address_street,address_city,address_state,address_zip')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();

    const fullName = profileRow?.full_name || username || 'Your Name';
    const addressLine1 = profileRow?.address_street || 'Address Street';
    const city = profileRow?.address_city || 'City';
    const state = profileRow?.address_state || 'ST';
    const zip = profileRow?.address_zip || '00000';
    const dateISO = new Date().toISOString().slice(0, 10);

    let generatedLetters = 0;

    for (const key of Object.keys(grouped)) {
      const [bureau, letterType] = key.split('::') as [Bureau, LetterType];
      const bucket = grouped[key];

      const html = letterHtml({
        fullName,
        addressLine1,
        city,
        state,
        zip,
        bureau,
        letterType,
        items: bucket,
        dateISO,
      });
      const pdfBuf = await htmlToPdfBuffer(html);
      const pdfPath = `user_${userId}/${bureau}/${Date.now()}_${letterType.replace(
        /\s+/g,
        '_'
      )}.pdf`;

      const upPdf = await supabase.storage
        .from('dispute-letters')
        .upload(pdfPath, pdfBuf, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (upPdf.error) throw upPdf.error;

      const accountName =
        bucket.length <= 1
          ? bucket[0]?.creditor || bucket[0]?.account_type || 'Account'
          : 'Multiple Accounts';

      const { data: insertedLetter, error: insertError } = await supabase
        .from('dispute_letters')
        .insert({
          user_id: userId,
          source_report_path: sourceReportPath,
          bureau,
          letter_type: letterType,
          items: bucket,
          num_items: bucket.length,
          html,
          pdf_path: pdfPath,
          status: 'Ready',
          account_name: accountName,
          version: 1,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (insertedLetter?.id) {
        const { error: automationUpdateError } = await supabase
          .from('dispute_letters')
          .update({
            user_email: userEmail,
            ...getInitialDisputeLetterAutomationFields(new Date()),
          })
          .eq('id', insertedLetter.id);

        if (automationUpdateError) {
          console.warn(
            '[credit-analysis] dispute-letter automation fields skipped:',
            automationUpdateError.message
          );
        }
      }

      generatedLetters += 1;
    }

    await attachDisputeLetters(reportId, {
      generated_count: generatedLetters,
      negative_item_count: items.length,
      generated_at: new Date().toISOString(),
    });

    await attachAnalysisResult(
      reportId,
      {
        negative_items: items,
        grouped_letters: Object.keys(grouped),
        generated_letter_count: generatedLetters,
      },
      { userId, userEmail }
    );

    await notifyDisputeLettersReady({
      reportId,
      userId,
      userEmail,
      generatedLetterCount: generatedLetters,
      letterTypes: generatedLetterTypes,
    });

    return {
      ok: true,
      extractedTextLength: reportText.length,
      negativeItemCount: items.length,
      generatedLetterCount: generatedLetters,
    };
  } catch (error) {
    await markCreditReportFailed(reportId, error, { userId, userEmail });
    throw error;
  }
}
