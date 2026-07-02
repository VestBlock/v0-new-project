# VestBlock Game-Changer Outreach Lanes

Last updated: 2026-07-02

These lanes are built on assets VestBlock actually owns (analyzer, buyer network, ledger,
DealVault) — not generic distress lists everyone else mails. Every competitor sends "we buy
houses." None of them can send what's below, because none of them have the machine behind it.

## Lane 1: Demand-Match ("we already have your buyer") — IMPLEMENTED

**The flip:** stop selling the owner on selling; show them the demand that already exists.
Outreach goes ONLY to owners whose property matches a confirmed, active buy box in the network,
and the copy says so specifically and truthfully: market, asset type, price band, close speed —
buyer anonymized.

**Why it's a category change:** response psychology inverts. "We buy houses" is a solicitation;
"a verified buyer is acquiring duplexes in Dayton in the $120-180k band and your property fits
the criteria" is information the owner did not have. Every confirmed buy box becomes a targeting
filter AND a copy asset. And it compounds: more buyers → more matchable lanes → more sellers →
more buyers.

**Compliance rule:** only send where a real active buy box matches. Never invent demand. If the
buyer pool is thin in a market, the lane simply produces zero drafts there — that honesty is the
moat.

**Run:** `npm run outreach:demand-match` (review-first; feeds verify → guarded sender).

## Lane 2: Transparent Underwriting ("here's our math")

Send the owner a real mini-analysis of THEIR property from the analyzer: rough value range,
likely cash-review band, and the repair sensitivity that drives it — with the disclaimer language
the analyzer already carries. Nobody in distressed outreach shows their math; showing it converts
skeptics that no volume of postcards can reach. Implementation: batch the rough-estimate engine
over an export CSV, render 5-line "screening snapshot" emails, review-first. Second touch for
reply-less lanes: the numbers ARE the follow-up.

## Lane 3: Backup-Offer Registry (agent co-op at scale)

Formalize the stale-listing lane into a standing product: any listing past 60 DOM gets a written,
no-obligation backup cash review the agent can keep in their file — agent keeps full commission,
VestBlock becomes "the backup offer people" in that market. Agents live in email, they answer,
and one agent relationship yields deals forever. The stale-listing finder already sources this;
the change is the offer framing plus a simple registry page (/backup-offer) for agents to submit
listings inbound.

## Lane 4: Post-Mortem for Expired Listings ("why it didn't sell")

Expired/withdrawn listings get an analyzer teardown: days-on-market vs price cuts, the price band
where it would have cleared, and the three exit paths (cash, creative, novation) with real
numbers. Expireds are a known lane — the teardown artifact is not. This is Lane 2's engine
pointed at the highest-intent segment that exists: owners who already tried to sell and failed.

## Lane 5: Proof-Backed Credibility (DealVault as outreach artifact)

Once 2-3 deals close through the machine: every outreach footer and follow-up carries a link to a
tamper-evident DealVault record of a completed deal — terms redacted, timeline and milestones
verifiable. "Every commitment we make is logged in a record we cannot edit" is a sentence no
competitor can send. Do NOT run this lane before real records exist; automation theater here
would poison the one asset that can't be rebuilt.

## Sequencing

1. Demand-Match now (implemented — needs confirmed buy boxes; the buyer network intake alert
   from today feeds it).
2. Transparent Underwriting as the second-touch engine for reply-less lanes (next build).
3. Backup-Offer Registry as the agent-facing standing offer (page + copy change, small build).
4. Post-Mortem when expired-listing sourcing is wired into the stale-listing finder.
5. Proof-Backed after the first closes.

Every lane obeys the standing rules: review-first sending, verified emails only, caps, suppression
discipline, no invented claims.
