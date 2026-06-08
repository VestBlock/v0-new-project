# Skip Tracing + Tools — Working the Distress List

We generate **free, daily, stacked distress leads** (with owner names + addresses). The two things money buys: **skip tracing** (owner phone/email) and **delinquency data in markets without open data** (Detroit, most counties). One tool covers both.

## The reality
- Owner **name + property address** = free (we have it: 98% of leads).
- Owner **phone/email/current mailing** = paid (regulated PII; no free reliable source).
- True tax-delinquency data in gated markets = paid.

## Tier 1 — buy this first
**DealMachine / PropStream class tool (~$99–199/mo)** — use this to skip trace, manage lists, and run direct-mail style follow-up after the public-record stack is built. DealMachine is now wired through `scripts/dealmachine-push.mjs` and can accept our highest-priority stacked leads by API or manual CSV import.
- `npm run distress:dealmachine` writes `data/distress-leads/dealmachine-import.csv`
- `npm run distress:dealmachine:pull` verifies API access without changing anything
- `npm run distress:dealmachine:push25` pushes only the top 25 leads by delinquent amount for the safest first live test
- PropStream and BatchLeads remain useful alternatives if we need broader paid tax-delinquency data or a different skip-trace workflow.

## Tier 2 — skip tracing at scale / API
**BatchData / BatchSkipTracing (~$0.07–0.15/hit, API)** — use if we want to automate skip tracing *into our pipeline* (hook stubbed in `scripts/skip-trace-prep.mjs --batchdata`). Alts: REISkip, Skip Genie, IDI/IDICORE (enterprise).

## Tier 3 — how you actually contact them
1. **Direct mail (start here — lowest compliance risk).** Sort leads by `delinquent_amount` desc, mail the top.
   - Mail houses: Open Letter Marketing, Yellow Letter HQ, Ballpoint Marketing (~$0.50–1.00/piece; handwritten/yellow letters convert best on distressed).
   - DIY API: **Lob** (postcards/letters via API ~$0.50–0.90) — our list can auto-feed Lob.
2. **Cold call / SMS (higher response, higher risk).**
   - Dialer: ReadyMode, Xencall, CallTools.
   - SMS: Launch Control, Smarter Contact, REIReply — **TCPA/SMS is heavily regulated; needs DNC scrub + consent. Hold until counsel guidance.**

## Tier 4 — CRM / pipeline
**REsimpli (~$99–299/mo)** — wholesaler-built: list mgmt + skip trace + dialer + CRM in one. Cheap start: Podio + GlobiFlow, or Airtable.

## Compliance (non-negotiable)
Contacting tax-delinquent / pre-foreclosure owners is regulated:
- **TCPA / DNC** for calls + texts — scrub DNC before dialing; don't text without consent.
- **State foreclosure-consultant / equity-purchaser laws** (CA and others) require disclosures + rescission rights.
- Direct mail is the safest opening channel.

## Cofounder recommendation (the play)
- **Month 1:** Buy PropStream ($99). Skip-trace our upload file + fill Detroit. Start **direct mail** (Lob / mail house) to the highest-`delinquent_amount` hits.
- Keep the free pipeline running daily ($0, fresh leads). Use PropStream for skip trace + gated markets.
- After a deal or two: add REsimpli (CRM) + a dialer + DNC scrub.
- **Total to validate the funnel: under ~$300.**

## Our files
- `data/distress-leads/MASTER-distress-stack.csv` — all stacked leads (grows daily)
- `data/distress-leads/skip-trace-upload.csv` — upload-ready (run `npm run distress:skiptrace-prep`)
- `data/distress-leads/dealmachine-import.csv` — DealMachine-ready import file sorted by highest delinquent amount first
