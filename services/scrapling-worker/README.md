# Vestblock Scrapling Worker — Gates 2–3

This is a private, Dockerized public-web research service. It is intentionally separate from the Next.js/Vercel application because it performs controlled network research and must not share the web app's execution boundary.

## What it does

- accepts one authenticated research request at a time;
- permits only explicit public allowlisted domains;
- checks the current DNS result is public and blocks private, loopback, link-local, and reserved targets;
- checks `robots.txt`, respects disallow rules, applies per-domain cooldowns, disables redirects, limits concurrency, and caches repeated idempotency keys locally;
- uses Scrapling's static `Fetcher` only; it does not use logged-in sessions, proxy rotation, browser-stealth mode, dynamic browser fetching, or bypass tools;
- returns bounded, structured public-page evidence marked research-only.
- when a durable Vestblock job ID is supplied, posts that evidence to the signed callback endpoint for review-only storage.

## What it never does

- sends outreach or creates CRM records;
- reads/writes Vestblock's database;
- follows redirects, accepts passwords/tokens in URLs, fetches unapproved domains, or accesses private networks;
- crawls a site, accesses an account, handles a CAPTCHA, or bypasses controls;
- stores raw pages, browser credentials, or customer data.

It also never treats evidence as a lead, contact, campaign enrollment, or permission to send. Vestblock's database stores every callback as pending review by default.

## Configuration

Required for any running instance:

```text
SCRAPLING_WORKER_TOKEN=<new high-entropy secret>
SCRAPLING_ALLOWED_DOMAINS=example.org,city.gov,approved-directory.example
SCRAPLING_TRUSTED_HOSTS=worker.internal.example,localhost,127.0.0.1
SCRAPLING_ENV=production
RESEARCH_WORKER_CALLBACK_URL=https://www.vestblock.io/api/webhooks/research-evidence
RESEARCH_WORKER_CALLBACK_SECRET=<new high-entropy secret shared only with Vestblock>
```

Optional operational controls:

```text
SCRAPLING_REQUEST_TIMEOUT_SECONDS=12
SCRAPLING_DOMAIN_MIN_INTERVAL_SECONDS=3
SCRAPLING_MAX_CONCURRENT_REQUESTS=2
SCRAPLING_MAX_RESPONSE_CHARACTERS=6000
SCRAPLING_MAX_REQUEST_BYTES=16384
SCRAPLING_IDEMPOTENCY_TTL_SECONDS=900
RESEARCH_WORKER_CALLBACK_TIMEOUT_SECONDS=10
```

Keep the worker private to the Vestblock/n8n network. Its worker token and callback secret belong in the host secret manager and Vercel's encrypted environment configuration, never in this repository or a browser-exposed `NEXT_PUBLIC_*` variable. The production worker refuses to start unless both callback values are present and its callback URL uses HTTPS.

Set the same `RESEARCH_WORKER_CALLBACK_SECRET` in the Vercel project. The callback endpoint verifies an HMAC signature over the exact request body and a five-minute timestamp window; it rejects replayed, unsigned, oversized, malformed, or source-mismatched evidence.

## Local verification

```bash
python3 -m venv /tmp/vestblock-scrapling-venv
source /tmp/vestblock-scrapling-venv/bin/activate
pip install -e '.[dev]'
pytest -q
python scripts/local_smoke.py
```

The smoke test is restricted to `example.com`, a public test domain. It does not create leads or send anything.

## Gate boundary

Gate 3 ends after the worker passes local and container tests, the signed callback is verified, the research migration is reviewed and applied in a future production gate, and the Command Center can surface source health. Creating a job via `/api/admin/research-jobs` only queues it; no worker dispatch, n8n workflow, Brain ingestion, CRM enrollment, or outreach is enabled until later approvals.
