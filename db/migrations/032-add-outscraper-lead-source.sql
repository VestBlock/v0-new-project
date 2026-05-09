INSERT INTO lead_sources (
  source_key,
  name,
  category,
  source_type,
  base_url,
  city,
  state,
  config_json,
  is_active
)
VALUES (
  'outscraper_google_maps_businesses',
  'Outscraper Google Maps',
  'small_business',
  'api',
  'https://outscraper.com/google-maps-api/',
  null,
  null,
  jsonb_build_object(
    'provider', 'outscraper',
    'supports_bulk_queries', true,
    'supports_spanish_leads', true
  ),
  true
)
ON CONFLICT (source_key) DO UPDATE
SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  source_type = EXCLUDED.source_type,
  base_url = EXCLUDED.base_url,
  config_json = EXCLUDED.config_json,
  is_active = EXCLUDED.is_active,
  updated_at = now();
