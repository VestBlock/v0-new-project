-- VestBlock content operations: SEO pages, social posts, and reusable campaign drafts.
-- Run in Supabase SQL Editor after the existing admin/automation migrations.

CREATE TABLE IF NOT EXISTS content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('seo_page', 'social_post', 'campaign')),
  service_key TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  audience TEXT,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published', 'archived')),
  platform TEXT,
  post_type TEXT,
  seo_title TEXT,
  meta_description TEXT,
  excerpt TEXT,
  body_markdown TEXT NOT NULL,
  social_caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  cta_label TEXT,
  cta_url TEXT,
  publish_path TEXT,
  metadata_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_assets_status ON content_assets(status);
CREATE INDEX IF NOT EXISTS idx_content_assets_content_type ON content_assets(content_type);
CREATE INDEX IF NOT EXISTS idx_content_assets_service_key ON content_assets(service_key);
CREATE INDEX IF NOT EXISTS idx_content_assets_created_at ON content_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_assets_published_at ON content_assets(published_at DESC);

ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published SEO content" ON content_assets;
CREATE POLICY "Public can view published SEO content"
  ON content_assets FOR SELECT
  TO anon
  USING (status = 'published' AND content_type = 'seo_page');

DROP POLICY IF EXISTS "Admins can view all content assets" ON content_assets;
CREATE POLICY "Admins can view all content assets"
  ON content_assets FOR SELECT
  TO authenticated
  USING (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can insert content assets" ON content_assets;
CREATE POLICY "Admins can insert content assets"
  ON content_assets FOR INSERT
  TO authenticated
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can update content assets" ON content_assets;
CREATE POLICY "Admins can update content assets"
  ON content_assets FOR UPDATE
  TO authenticated
  USING (private.vestblock_is_admin())
  WITH CHECK (private.vestblock_is_admin());

DROP POLICY IF EXISTS "Admins can delete content assets" ON content_assets;
CREATE POLICY "Admins can delete content assets"
  ON content_assets FOR DELETE
  TO authenticated
  USING (private.vestblock_is_admin());

GRANT SELECT ON content_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_assets TO authenticated;
GRANT ALL ON content_assets TO service_role;
