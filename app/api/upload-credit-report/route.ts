export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

import type { NegativeItem } from '@/lib/extract-negative-items';
import UploadNotificationEmail from '@/components/email-template';

// Server-side Supabase client with service role key (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const resend = new Resend(process.env.RESEND_API_KEY);

const BUREAUS = ['Experian', 'Equifax', 'TransUnion'] as const;
type Bureau = (typeof BUREAUS)[number];

export async function GET() {
  try {
    const { data: reports, error } = await supabaseAdmin
      .from('credit_reports')
      .select('id, user_id, file_name, file_path, uploaded_at')
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    // 2) For each, generate a signed URL
    const enriched = await Promise.all(
      reports.map(async (r) => {
        // 1) Get the user record
        const { data: usr } = await supabaseAdmin.auth.admin.getUserById(
          r.user_id
        );
        console.debug('🚀 ~ GET ~ usr:', usr);
        const email = usr?.user?.email;

        // 2) Create a 1-hour signed URL
        const { data: urlData } = await supabaseAdmin.storage
          .from('credit-reports')
          .createSignedUrl(r.file_path, 3600);

        console.debug('🚀 ~ GET ~ urlData:', urlData);
        return {
          id: r.id,
          userEmail: email,
          fileName: r.file_name,
          uploadedAt: r.uploaded_at,
          fileUrl: urlData?.signedUrl,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Could not load reports' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 ~ POST ~ request:', request);
  try {
    const [{ htmlToPdfBuffer }, extractMod, { letterHtml }] = await Promise.all(
      [
        import('@/lib/letters/render'), // safe renderer (must be lazy)
        import('@/lib/extract-negative-items'), // has pdf-parse / sharp / tesseract
        import('@/lib/letters/templates'), // string-only letter template
      ]
    );

    const { extractNegativeItemsFromText, extractTextFromPdf, ocrImageToText } =
      extractMod;

    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const username = formData.get('username') as string;
    // const additionalInfo = formData.get('additionalInfo') as string;
    const email = formData.get('email') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      userId: userId,
    });

    // Validate file
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only PDF and Image files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 25MB)' },
        { status: 400 }
      );
    }

    if (file.size < 100) {
      return NextResponse.json(
        { error: 'File too small or corrupted' },
        { status: 400 }
      );
    }

    // Create a simple file name
    const timestamp = Date.now();
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase();

    const fileName = `${userId}/${timestamp}_${sanitizedFileName}`;

    console.log('Uploading to bucket: credit-reports');
    console.log('Uploading to path:', fileName);

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);

    // Upload using admin client to credit-reports bucket (bypasses RLS)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('credit-reports')
      .upload(fileName, uint8Array, {
        contentType: file.type,
        // contentType: "application/pdf",
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      console.error('Failed to upload to credit-reports bucket');
      return NextResponse.json(
        {
          error: `Upload failed: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    console.log(
      'File uploaded successfully to credit-reports bucket:',
      uploadData.path
    );
    console.log('Full upload data:', uploadData);

    if (uploadData) {
      // Insert a row in credit_reports
      await supabaseAdmin.from('credit_reports').insert({
        user_id: userId,
        file_name: fileName,
        file_path: uploadData.path,
        // uploaded_at defaults automatically
      });
    }

    const { data, error: ResendError } = await resend.emails.send({
      from: process.env.RESEND_EMAIL!,
      to: email,
      subject: 'You got a new credit report!',
      react: UploadNotificationEmail({
        firstName: username || '',
        fileName: fileName,
        adminPanelUrl: 'https://www.vestblock.io',
      }),
    });
    console.debug('🚀 ~ POST ~ data:', data, ResendError);

    if (ResendError) {
      return Response.json({ ResendError });
    }

    try {
      // 1) get the original bytes we already loaded
      //    (we still have fileBuffer/uint8Array from above)
      const reportText =
        file.type === 'application/pdf'
          ? await extractTextFromPdf(fileBuffer)
          : await ocrImageToText(fileBuffer); // TODO: add OCR fallback for images if/when needed

      console.log('🚀 ~ POST ~ reportText:', reportText);
      // 2) extract negative items via OpenAI
      const items = reportText
        ? await extractNegativeItemsFromText(reportText)
        : [];
      console.log('🚀 ~ POST ~ items:', items);

      // Group items by bureau + letter type
      const grouped: Record<string, NegativeItem[]> = {};
      console.log('🚀 ~ POST ~ grouped:', grouped);
      for (const it of items) {
        for (const bureau of it.bureaus) {
          const key = `${bureau}::${it.suggested_letter_type}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(it);
        }
      }

      // Get name/address from your sources (user_metadata or user_profiles)
      // Replace with your actual profile fetch if you have a table:
      const { data: profileRow } = await supabaseAdmin
        .from('user_profiles')
        .select(
          'full_name,address_street,address_city,address_state,address_zip'
        )
        .eq('id', userId)
        .maybeSingle();

      console.log('🚀 ~ POST ~ profileRow:', profileRow);
      const fullName = profileRow?.full_name || username || 'Your Name';
      const addressLine1 = profileRow?.address_street || 'Address Street';
      const city = profileRow?.address_city || 'City';
      const state = profileRow?.address_state || 'ST';
      const zip = profileRow?.address_zip || '00000';

      const dateISO = new Date().toISOString().slice(0, 10);

      // 3) create letters (HTML + PDF) and store rows
      for (const key of Object.keys(grouped)) {
        const [bureau, letterType] = key.split('::') as [Bureau, string];
        const bucket = grouped[key];

        const html = letterHtml({
          fullName,
          addressLine1,
          city,
          state,
          zip,
          bureau,
          letterType: letterType as any,
          items: bucket,
          dateISO,
        });
        const pdfBuf = await htmlToPdfBuffer(html);

        const pdfPath = `user_${userId}/${bureau}/${Date.now()}_${letterType.replace(
          /\s+/g,
          '_'
        )}.pdf`;
        const upPdf = await supabaseAdmin.storage
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

        const { error: insErr } = await supabaseAdmin
          .from('dispute_letters')
          .insert({
            user_id: userId,
            source_report_path: uploadData.path,
            bureau,
            letter_type: letterType,
            items: bucket,
            num_items: bucket.length,
            html,
            pdf_path: pdfPath,
            status: 'Ready',
            account_name: accountName,
            version: 1,
          });

        if (insErr) throw insErr;
      }
    } catch (letterErr) {
      throw letterErr;
    }

    // NO DATABASE OPERATIONS - Just file upload to storage
    // This eliminates all database-related errors

    return NextResponse.json({
      success: true,
      filePath: uploadData.path,
      fileName: file.name,
      bucket: 'credit-reports',
      uploadedAt: new Date().toISOString(),
      message: 'File uploaded successfully to credit-reports bucket',
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error during upload',
      },
      { status: 500 }
    );
  }
}
