# VestBlock Autopilot Tool Evaluation

**Reviewed:** 2026-08-10  
**Execution target:** primary Mac Pro repository, with account setup performed from Robert's MacBook Air

## Adopted now

| Tool | Decision | VestBlock use |
| --- | --- | --- |
| MarketingSkills (`coreyhaines31/marketingskills`, MIT, `7868cb9`) | Ten bounded Codex skills installed | SEO audit, programmatic SEO, content strategy, CRO, copy, prospecting, PR, analytics, ads, and attribution. These become available to Codex on the next task. |
| No AI Slop (`petergyang/no-ai-slop`, MIT) | Already installed and used | Final copy pass without changing claims or voice. |
| I Have ADHD (`ayghri/i-have-adhd`, MIT, `2ed0640`) | Already installed | Action-first communication. The always-on hooks and evaluation runners were not installed or executed. |
| Strix (`usestrix/strix`, Apache-2.0, `7cc9fa9`) | Two defensive skills installed | CI security scanning guidance and remediation guidance. The Strix CLI, cloud connection, pentest skill, telemetry, and exploit runtime were not installed or run. Any future scan is limited to VestBlock-owned assets with explicit scope. |
| Obsidian Skills (`kepano/obsidian-skills`, MIT, `a1dc48e`) | Four bounded skills installed | Markdown, Bases, JSON Canvas, and CLI guidance power a local derived strategy vault. Supabase remains authoritative and no lead/customer PII is exported. The built-in CLI awaits its one-time in-app enablement toggle. |

## Registered, not deployed

| Tool | Decision | Reason |
| --- | --- | --- |
| Buffer | Use the existing approval-gated account and direct API | The founder declined a self-hosted social aggregator. Buffer already has seven channels and an active VestBlock key; credential transfer still requires confirmation and publishing remains approval-gated. |
| n8n (`n8n-io/n8n`, fair-code) | Use as a signed execution bridge | Published workflow `wyi6LMTPGkhZCYYa` is protected by Header Auth and accepts a signed envelope, but returns preview-only HTTP 202 and has no downstream write nodes. VestBlock remains the source of truth. Community workflows will not be imported without line-by-line security review. |
| Claude SEO (`AgricIDaniel/claude-seo`, MIT, `09d37c7`) | Use concepts, not the full 25-skill stack | The useful audit, schema, local, technical, GEO, and site-architecture patterns overlap with the smaller installed stack. Several modules introduce extra provider credentials and scripts. |
| LangChain social-media-agent (`langchain-ai/social-media-agent`, MIT, `c0d35be`) | Reuse the human-in-the-loop pattern only | Running it would add LangGraph, LangSmith, Arcade, Slack, GitHub, X, and LinkedIn credentials while duplicating the existing Buffer/content-calendar path. |
| OpenAI Ads Manager and Advertiser API | Adopt read-only reporting first | Official self-serve ChatGPT Ads and an account-scoped API now exist. VestBlock must complete advertiser and restricted financial-services review before launch. Campaign creation, activation, bids, budgets, billing, and spend remain outside automatic authority. |
| OpenSEO (`every-app/open-seo`, `edc2c07`) | Candidate SEO data/MCP service | It is a full service, not a Codex skill. Deploy only after its data sources, auth boundary, storage, resource requirements, and Supabase overlap are reviewed. |
| Open Notebook (`lfnovo/open-notebook`, `a7de90d`) | Candidate private research workspace | Useful for source-grounded research, but it is a separate database/vector/service stack. It is not required to operate the first Autopilot slice. |
| Open Generative AI (`Anil-matcha/Open-Generative-AI`, MIT, `2f71b75`) | Candidate media provider, not installed | The desktop build is unnotarized and the linked media skills execute a third-party MuAPI using a separate paid credential. VestBlock stores scripts and shot lists now; rendering stays blocked until a provider is approved. |

## Deliberately excluded

- No unreviewed binaries, Docker stacks, `curl | bash` installers, community n8n workflows, or unknown credential bundles were added.
- No tool received production secrets, customer data, social account access, ad-account access, or publishing authority.
- No offensive Strix capability was run.
