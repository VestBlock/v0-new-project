-- Create user_documents table
CREATE TABLE IF NOT EXISTS public.user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    document_type TEXT, -- e.g., 'dispute_letter', 'credit_report_analysis', 'financial_plan'
    -- You might want to add a reference to the actual document if stored elsewhere,
    -- e.g., storage_path TEXT, or a foreign key to another table like 'dispute_letters'
    -- For now, this is a simple log.
    related_item_id UUID, -- Optional: FK to dispute_letters.id or other tables
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- Trigger to update "updated_at" timestamp
CREATE TRIGGER on_user_documents_updated
BEFORE UPDATE ON public.user_documents
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at(); -- Re-use existing function

-- Policies for user_documents
CREATE POLICY "Users can view their own documents"
ON public.user_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
ON public.user_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
ON public.user_documents FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON public.user_documents FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_documents IS 'Tracks documents or significant items related to a user, like generated letters or analyses.';
