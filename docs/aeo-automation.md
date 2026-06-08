# VestBlock — Daily AEO Site Audit

## What is AEO?

Answer Engine Optimization (AEO) is the practice of making your website content easier for AI-powered search and answer engines to understand, trust, and cite. This includes Google AI Overviews, ChatGPT, Perplexity, Claude, and other LLM-driven discovery tools.

---

## Daily AEO Audit — How It Works

### Endpoint
`GET /api/cron/aeo-site-audit`

### Schedule
Runs every day at **9:00 AM UTC** via Vercel Cron (configured in `vercel.json`).

### Authorization
Requires a `Bearer` token matching the `CRON_SECRET` environment variable. In development (no `CRON_SECRET` set), the route runs unauthenticated.

### What It Checks

1. **Route Availability** — Fetches all core public pages via HTTP HEAD and verifies they return 2xx/3xx. Critical routes (homepage, `/sell`, `/buyers`, `/lenders`, `/dealvault`) are weighted more heavily.

2. **robots.txt Health** — Verifies that:
   - All core public paths are in the `Allow:` list
   - AEO user agents (`GPTBot`, `ClaudeBot`, `PerplexityBot`) are explicitly allowed
   - A `Sitemap:` directive is present

3. **Sitemap Completeness** — Fetches `/sitemap.xml`, counts total URLs, and verifies that all required deal-routing paths are present.

4. **Structured Data (Schema.org)** — Fetches key pages and parses `application/ld+json` blocks to verify required schema types:
   - Homepage: `FAQPage`, `Organization`, `WebSite`, `Service`
   - DealVault: `FAQPage`, `Service`, `BreadcrumbList`
   - Services: `ItemList`

5. **Scoring** — Produces a 0–100 AEO health score with sub-scores for routes, robots, sitemap, and schema. Surfaces critical issues and recommendations.

### Score Weights
| Area | Weight |
|------|--------|
| Route availability | 35% |
| Sitemap completeness | 25% |
| robots.txt health | 20% |
| Structured data coverage | 20% |

---

## Output

### Response Body (JSON)
```json
{
  "success": true,
  "overallScore": 94,
  "scoreSummary": {
    "routes": 100,
    "robots": 90,
    "sitemap": 95,
    "schema": 87
  },
  "criticalIssues": [],
  "recommendations": [
    "AEO health is strong. Continue publishing answer-ready content and FAQ updates."
  ],
  "routeResults": [...],
  "robotsAudit": {...},
  "sitemapAudit": {...},
  "schemaAudits": [...],
  "runAt": "2026-06-01T09:00:00.000Z"
}
```

### Persistence (Supabase)
If `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) are set, each audit run is stored in the `aeo_audit_reports` table for trending and history.

**Schema for `aeo_audit_reports` table:**
```sql
create table if not exists aeo_audit_reports (
  id uuid default gen_random_uuid() primary key,
  run_at timestamptz not null,
  site_url text not null,
  overall_score integer not null,
  score_summary jsonb,
  critical_issues jsonb,
  recommendations jsonb,
  route_results jsonb,
  robots_audit jsonb,
  sitemap_audit jsonb,
  schema_audits jsonb,
  created_at timestamptz default now()
);
```

---

## Running Manually

```bash
# Dry run (no Supabase write)
curl "http://localhost:3001/api/cron/aeo-site-audit?dryRun=true"

# With auth in production
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://www.vestblock.io/api/cron/aeo-site-audit"
```

Or via npm script:
```bash
pnpm run aeo:daily-audit
```

---

## Configuration

| Environment Variable | Purpose | Required |
|---|---|---|
| `CRON_SECRET` | Authorizes cron calls | Production |
| `NEXT_PUBLIC_SITE_URL` | Base URL for audit | Recommended |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase for persistence | Optional |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Optional |

---

## AEO Best Practices Applied

1. **robots.txt** — Explicitly allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, and other AEO crawlers in addition to standard Googlebot.

2. **Structured Data** — Homepage includes `Organization`, `WebSite`, `FAQPage`, and `Service` schemas. DealVault includes `FAQPage`, `Service`, and `BreadcrumbList`. Services page includes `ItemList`.

3. **Sitemap** — All core deal-routing pages (`/sell`, `/buyers`, `/lenders`, `/dealvault`, etc.) are included with `weekly` change frequency and appropriate priority scores.

4. **Answer-Ready Content** — FAQ sections on the homepage and DealVault page use plain-language answers to the most common questions asked about VestBlock to answer engines.

5. **Entity Clarity** — VestBlock is consistently described as a "real estate deal-routing platform" with "DealVault blockchain proof records" to build entity recognition across AI search systems.

---

## Recommended Follow-Up

- Add `aeo_audit_reports` table to Supabase and link to the admin panel for trend visibility.
- Add a Slack webhook notification when overall score drops below 80.
- Expand schema coverage to `/buyers`, `/lenders`, and `/sell` pages.
- Add `HowTo` schema to the "How it works" section on the homepage.
- Publish more AEO topic pages in `/learn` targeting common real estate deal Q&A.
