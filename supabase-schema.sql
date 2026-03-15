-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  credit_score INTEGER,
  goals TEXT,
  income NUMERIC,
  business_ein TEXT,
  country TEXT DEFAULT 'United States',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat history table
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user documents table
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'dispute_letter', 'credit_report', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit reports table
CREATE TABLE IF NOT EXISTS credit_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_text TEXT,
  credit_score INTEGER,
  negative_items JSONB,
  accounts JSONB,
  inquiries JSONB,
  public_records JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dispute letters table
CREATE TABLE IF NOT EXISTS dispute_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  letter_type TEXT NOT NULL, -- '609', 'goodwill', 'pay_for_delete', etc.
  creditor_name TEXT,
  account_number TEXT,
  letter_content TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'responded'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_letters ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Chat history policies
CREATE POLICY "Users can view their own chat history"
  ON chat_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat history"
  ON chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User documents policies
CREATE POLICY "Users can view their own documents"
  ON user_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
  ON user_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Credit reports policies
CREATE POLICY "Users can view their own credit reports"
  ON credit_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit reports"
  ON credit_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Dispute letters policies
CREATE POLICY "Users can view their own dispute letters"
  ON dispute_letters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dispute letters"
  ON dispute_letters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dispute letters"
  ON dispute_letters FOR UPDATE
  USING (auth.uid() = user_id);
