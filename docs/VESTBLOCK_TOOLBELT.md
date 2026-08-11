# VestBlock Strategy Toolbelt

## Location and operating model

The source toolbelt is installed separately from the customer application on the MacBook Pro at:

`/Users/mrsanders/VestBlockOps/toolbelt`

Repositories are pinned by commit and do not become VestBlock runtime dependencies merely because they are present. Full applications remain unconfigured until a scoped use case, license review, data boundary, credentials, and operating budget are approved.

## Installed sources

| Project | Strategy lane | License | Pinned revision | Current state |
| --- | --- | --- | --- | --- |
| Strix (`usestrix/strix`) | Authorized application security | Apache-2.0 | `ac0014fe6540506777ff7df028f9309f0785fa6d` (`v1.4.1`) | Source only; no scan executed |
| Open Generative AI (`Anil-matcha/Open-Generative-AI`) | Creative production and campaign assets | MIT | `2f71b75264f8ae1ced9e9618faadecc3110fa39e` | Source only; no API key or model vendor connected |
| OpenSEO (`every-app/open-seo`) | SEO, AEO, keyword, competitor, and link strategy | MIT | `edc2c07af215e61931f884f08f3f94a8470a4bfb` | Source pinned; eight agent workflow skills installed |
| I Have ADHD (`ayghri/i-have-adhd`) | Clear owner communication and execution handoffs | MIT | `2ed064090711586e0c97a2fbbf15465fe8f1808b` | Codex skill installed globally |
| No AI Slop (`petergyang/no-ai-slop`) | Brand voice, content, and copy review | MIT | `d30eddb9e04562234f2070b5ee63ca4649d9a05e` | Codex skill installed globally |
| Open Notebook (`lfnovo/open-notebook`) | Private research and strategy knowledge base | MIT | `a7de90d38aaf18ee85fd661854d35c11e44613e2` | Source only; no knowledge store or model connected |

## Enabled Codex skills

The following will be discoverable from `/Users/mrsanders/.codex/skills` on a new Codex task:

- `i-have-adhd`
- `no-ai-slop`
- `keyword-research`
- `keyword-clustering`
- `seo-project-setup`
- `seo-coach`
- `competitor-analysis`
- `seo-audit`
- `competitive-landscape`
- `link-prospecting`

OpenSEO's live workflows still require an intentional OpenSEO MCP/account connection. The skills may not invent unavailable metrics and must ask before saving keyword data.

## Lane policy

### Security

Strix may run only against an explicitly authorized local, preview, or staging target with written scope, a fixed budget, and human monitoring. It must not attack third-party systems, production, customer infrastructure, or an unspecified host. Findings require manual verification before code changes.

### Creative

Open Generative AI is quarantined as source because it connects to many third-party models and advertises unfiltered generation. Do not add provider keys, remove macOS security controls, ingest customer data, or publish generated media until the selected provider, content policy, attribution, and budget are approved. VestBlock's existing image-generation path remains the default.

### SEO and AEO

OpenSEO skills support evidence-based keyword research, clustering, competitive analysis, site audits, and link prospecting. Preserve existing URLs, canonical behavior, structured data, and search equity. No bulk publishing, invented metrics, or automated outreach.

### Research

Open Notebook can become the private research layer for market notes, lender/program documentation, customer research, and strategy evidence. It is not running yet. Before activation, define storage retention, model/provider boundaries, backup, access, and a rule excluding credentials and unredacted customer financial data.

### Communication and content

I Have ADHD is opt-in and reshapes task handoffs into short, executable steps. No AI Slop is the editorial review layer for public copy and can detect or edit repetitive model-generated patterns while preserving the owner's voice.

## Update procedure

1. Fetch upstream metadata and read release/security notes.
2. Review the diff from the pinned commit; never auto-update.
3. Recheck the license and data/credential model.
4. Test in an isolated environment with no production secrets.
5. Update this manifest only after the new revision is accepted.
