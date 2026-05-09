import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/supabase';

export type UserDocumentType =
  | 'credit_report'
  | 'dispute_letter'
  | 'funding_document'
  | 'grant_document'
  | 'legal_document'
  | 'intake_document'
  | 'general_document';

export type UserDocumentStatus = 'processing' | 'ready' | 'failed' | 'archived';

type RegisterUserDocumentInput = {
  userId: string;
  documentName: string;
  documentType: UserDocumentType;
  documentUrl?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  relatedItemId?: string | null;
  status?: UserDocumentStatus;
  metadataJson?: Json;
};

export async function registerUserDocument(input: RegisterUserDocumentInput) {
  const admin = createAdminClient();
  const payload = {
    user_id: input.userId,
    document_name: input.documentName,
    document_type: input.documentType,
    document_url: input.documentUrl ?? null,
    storage_bucket: input.storageBucket ?? null,
    storage_path: input.storagePath ?? null,
    related_item_id: input.relatedItemId ?? null,
    status: input.status ?? 'ready',
    metadata_json: input.metadataJson ?? {},
  };

  const { data, error } = await admin
    .from('user_documents')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserDocumentByRelatedItem(input: {
  userId?: string | null;
  relatedItemId: string;
  updates: {
    status?: UserDocumentStatus;
    documentUrl?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    metadataJson?: Json;
  };
}) {
  const admin = createAdminClient();
  const payload: Record<string, unknown> = {};

  if (input.updates.status) payload.status = input.updates.status;
  if (typeof input.updates.documentUrl !== 'undefined') payload.document_url = input.updates.documentUrl;
  if (typeof input.updates.storageBucket !== 'undefined') payload.storage_bucket = input.updates.storageBucket;
  if (typeof input.updates.storagePath !== 'undefined') payload.storage_path = input.updates.storagePath;
  if (typeof input.updates.metadataJson !== 'undefined') payload.metadata_json = input.updates.metadataJson;

  let query = admin.from('user_documents').update(payload).eq('related_item_id', input.relatedItemId);
  if (input.userId) {
    query = query.eq('user_id', input.userId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function listUserDocuments(userId: string, options?: { type?: string; limit?: number }) {
  const admin = createAdminClient();
  let query = admin
    .from('user_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.type) {
    query = query.eq('document_type', options.type);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
