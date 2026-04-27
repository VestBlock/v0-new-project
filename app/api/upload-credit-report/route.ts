export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { createCreditReportRecord } from '@/lib/workflows/creditRepairWorkflow';
import { processCreditReportAnalysis } from '@/lib/workflows/processCreditReportAnalysis';

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
        const email = usr?.user?.email;

        // 2) Create a 1-hour signed URL
        const { data: urlData } = await supabaseAdmin.storage
          .from('credit-reports')
          .createSignedUrl(r.file_path, 3600);

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
  try {
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

    console.info('[credit-upload] Upload received:', {
      size: file.size,
      type: file.type,
      userId,
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

    console.info('[credit-upload] File stored in credit-reports bucket.', {
      path: uploadData.path,
      userId,
    });

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = email || authUser?.user?.email || null;
    const reportId = await createCreditReportRecord({
      userId,
      userEmail,
      fileName: file.name,
      filePath: uploadData.path,
    });

    try {
      await processCreditReportAnalysis({
        reportId,
        userId,
        userEmail,
        username,
        fileBuffer,
        fileType: file.type,
        sourceReportPath: uploadData.path,
      });
    } catch (letterErr) {
      console.error('Credit analysis/dispute generation failed:', letterErr);
    }

    return NextResponse.json({
      success: true,
      reportId,
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
