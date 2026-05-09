import { NextRequest, NextResponse } from 'next/server';
import { listUserDocuments } from '@/lib/documents/service';
import { getSupabaseServer } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const type = request.nextUrl.searchParams.get('type') || undefined;
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 10, 1), 25) : 10;

    const admin = createAdminClient();
    const documents = await listUserDocuments(user.id, { type, limit });

    const enriched = await Promise.all(
      documents.map(async (document) => {
        let accessUrl = document.document_url || null;

        if (!accessUrl && document.storage_bucket && document.storage_path) {
          const { data } = await admin.storage
            .from(document.storage_bucket)
            .createSignedUrl(document.storage_path, 3600);
          accessUrl = data?.signedUrl || null;
        }

        return {
          id: document.id,
          documentName: document.document_name,
          documentType: document.document_type,
          status: document.status || 'ready',
          relatedItemId: document.related_item_id,
          createdAt: document.created_at,
          updatedAt: document.updated_at || document.created_at,
          accessUrl,
          storageBucket: document.storage_bucket,
          storagePath: document.storage_path,
          metadata: document.metadata_json || {},
        };
      }),
    );

    return NextResponse.json({ documents: enriched });
  } catch (error: any) {
    console.error('[documents] list failed:', error);
    return NextResponse.json(
      { error: 'Failed to load documents', details: error?.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
