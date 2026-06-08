/**
 * VestBlock Facebook Buffer calendar.
 *
 * Generates 90 days of Facebook content and, with --send, schedules it into
 * Buffer using the current GraphQL API. Dry-run by default.
 *
 * Usage:
 *   node scripts/buffer-facebook-content-calendar.mjs
 *   BUFFER_API_KEY=... node scripts/buffer-facebook-content-calendar.mjs --send --max=6
 */

import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const SEND = args.includes("--send")
const START_DATE = getArg("start") || "2026-06-05"
const MAX_TO_SEND = getArg("max") ? Number.parseInt(getArg("max"), 10) : null
const DEFAULT_CHANNEL_ID = "6824f8e7f49c987a95b0151f"
const FACEBOOK_CHANNEL_ID = getArg("channel") || process.env.BUFFER_FACEBOOK_CHANNEL_ID || DEFAULT_CHANNEL_ID
const OUT_DIR = path.join(process.cwd(), "data", "buffer")
const JSON_OUT = path.join(OUT_DIR, "vestblock-facebook-90-day-calendar.json")
const CSV_OUT = path.join(OUT_DIR, "vestblock-facebook-90-day-calendar.csv")
const TEAM_OUT = path.join(process.cwd(), "docs", "VESTBLOCK_FACEBOOK_CONTENT_TEAM.md")
const RESULTS_PREFIX = "vestblock-facebook-buffer-results-"

function getArg(name) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : null
}

const contentTeam = [
  {
    role: "Editor in Chief",
    owner: "Brand and direction",
    job: "Keep every post aligned with VestBlock as a real estate partner network: sellers, buyers, lenders, operators, capital partners, DealVault, and visibility support.",
  },
  {
    role: "Acquisitions Voice",
    owner: "Seller pain and offer paths",
    job: "Explain fast cash, creative structure, and novation review without promising offers, prices, or timelines.",
  },
  {
    role: "Buyer Network Strategist",
    owner: "Buy box and deal flow",
    job: "Speak to buyers who need better-fit opportunities, clean criteria, and capital confidence before they move.",
  },
  {
    role: "Capital Partner Editor",
    owner: "No Limit Capital and funding education",
    job: "Frame NLC as a partner path for fix-and-flip, bridge, DSCR, and ground-up construction review while keeping terms subject to underwriting.",
  },
  {
    role: "DealVault Trust Producer",
    owner: "Proof and partner trust",
    job: "Turn messy referral, payout, milestone, and partner-agreement pain into simple proof-layer content.",
  },
  {
    role: "AEO/SEO Growth Producer",
    owner: "Member visibility campaigns",
    job: "Explain how VestBlock can help buyers, lenders, sellers, and operators become easier to find and understand online.",
  },
  {
    role: "Compliance Editor",
    owner: "Risk review",
    job: "Remove guarantees, broker/lender confusion, unsupported claims, and raw partner pricing that should not be public copy.",
  },
]

const posts = [
  {
    theme: "positioning",
    type: "manifesto",
    audience: "all",
    link: "https://vestblock.io",
    text: "VestBlock is being built for one problem: real estate opportunities are everywhere, but the right people rarely see the right deal at the right time.\n\nSellers need options. Buyers need cleaner deal flow. Lenders need files that fit their box. Contractors and developers need better project conversations. Partners need proof when money, milestones, and referrals are involved.\n\nThat is the network we are building.\n\nConnect. Route. Fund. Build.\n\nStart here: https://vestblock.io\n\n#VestBlock #RealEstateInvesting #PropTech",
  },
  {
    theme: "seller pain",
    type: "pain point",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "A seller does not always need one path.\n\nSometimes the right move is a fast cash review.\nSometimes it is a creative structure.\nSometimes a novation or market-assisted path makes more sense.\nSometimes the property needs a buyer, lender, contractor, or partner conversation before a realistic path is clear.\n\nVestBlock starts with the property details first, then routes the conversation from there.\n\nSubmit a property: https://vestblock.io/sell\n\nNo guaranteed offer, price, timeline, or closing. Every file depends on the property, title, payoff, condition, and buyer demand.\n\n#RealEstate #SellMyHouse #OffMarket",
  },
  {
    theme: "buyer buy box",
    type: "education",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "If your buy box only lives in text messages, DMs, and old emails, you are harder to match.\n\nVestBlock lets buyers put the important criteria in one place:\n- Markets\n- Asset types\n- Price range\n- Rehab appetite\n- Deal structures\n- Proof status\n- No-go items\n\nCleaner criteria means fewer random deals and more conversations that actually fit.\n\nShare your buy box: https://vestblock.io/buyers\n\n#CashBuyers #RealEstateInvestors #BuyBox",
  },
  {
    theme: "capital",
    type: "partner offer",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "A good buyer without a capital path can still lose a good deal.\n\nThat is why VestBlock now has a No Limit Capital partner path for qualified investor files.\n\nPotential lanes include:\n- Fix and flip\n- Bridge\n- DSCR rental\n- Ground-up construction\n\nVestBlock can help organize the deal context. No Limit Capital determines final eligibility, pricing, leverage, terms, appraisal requirements, and approvals.\n\nRequest funding review: https://vestblock.io/real-estate-funding\n\n#FixAndFlip #RealEstateFunding #DSCR",
  },
  {
    theme: "dealvault",
    type: "trust",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "The real estate world runs on relationships, but relationships break when the record is unclear.\n\nWho brought the deal?\nWho is owed a referral?\nWhat milestone was completed?\nWhat changed after the first agreement?\nWho approved the payout?\n\nDealVault is VestBlock's proof layer for cleaner records around deals, payouts, milestones, and partner accountability.\n\nSee DealVault: https://vestblock.io/dealvault\n\n#DealVault #RealEstatePartnerships #PropTech",
  },
  {
    theme: "lenders",
    type: "network",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Lenders do not need more random files.\n\nThey need borrowers and deals that match their actual lending box.\n\nVestBlock lets lenders share:\n- States served\n- Loan size range\n- Asset types\n- Minimum credit or DSCR requirements\n- Deal types they actually want\n- No-go items\n\nThen we can route better-fit conversations when opportunities come through the network.\n\nJoin the lender network: https://vestblock.io/lenders\n\n#PrivateLending #HardMoneyLender #RealEstateDeals",
  },
  {
    theme: "visibility",
    type: "service",
    audience: "members",
    link: "https://vestblock.io/visibility-expansion",
    text: "Being a good buyer, lender, operator, or service partner is not enough if nobody understands what you do.\n\nVestBlock can support members with AI-powered SEO/AEO visibility campaigns so their criteria, markets, and services are easier for sellers, partners, and answer engines to understand.\n\nThis is not just posting online. It is building clearer market signals around who you are, what you buy, where you lend, or what projects you support.\n\nExplore visibility support: https://vestblock.io/visibility-expansion\n\n#AEO #SEO #RealEstateMarketing",
  },
  {
    theme: "operators",
    type: "network expansion",
    audience: "contractors",
    link: "https://vestblock.io",
    text: "The next version of real estate deal flow is not just sellers and buyers.\n\nIt includes:\n- Contractors\n- Developers\n- Private lenders\n- DSCR lenders\n- Cash buyers\n- Creative finance buyers\n- Wholesalers\n- Operators\n- Service partners\n\nBecause many opportunities need more than one person to become a real deal.\n\nVestBlock is building that routing layer.\n\nStart here: https://vestblock.io\n\n#Construction #RealEstateDevelopment #DealFlow",
  },
  {
    theme: "seller education",
    type: "myth",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Myth: If a property has repairs, code issues, taxes, or a tight timeline, there is only one option.\n\nReality: the best path depends on the numbers.\n\nA property could fit:\n- Fast cash review\n- Creative structure\n- Novation review\n- Buyer introduction\n- Contractor or partner conversation\n\nVestBlock starts by understanding the situation before forcing the path.\n\nSubmit property details: https://vestblock.io/sell\n\n#DistressedProperty #RealEstateOptions #MilwaukeeRealEstate",
  },
  {
    theme: "buyer pain",
    type: "pain point",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Most buyers do not lose because they lack motivation.\n\nThey lose because the deals they see are late, mismatched, over-shopped, or missing the context needed to move quickly.\n\nVestBlock is building a buyer network around actual buy boxes, proof, capital paths, and seller context.\n\nIf you buy real estate, tell us what actually fits.\n\nShare your criteria: https://vestblock.io/buyers\n\n#RealEstateInvestor #OffMarketDeals #CashBuyer",
  },
  {
    theme: "capital education",
    type: "education",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Before a lender reviews a real estate deal, the file needs to make sense.\n\nA stronger funding conversation usually includes:\n- Purchase price\n- Rehab budget\n- ARV or current value\n- Exit strategy\n- Borrower experience\n- Liquidity\n- Timeline\n- Property address\n- Contract status\n\nVestBlock helps organize that context before the file is routed for review.\n\nStart funding review: https://vestblock.io/real-estate-funding\n\n#RealEstateFunding #BridgeLoan #FixAndFlip",
  },
  {
    theme: "dealvault",
    type: "scenario",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "Scenario: A buyer, lender, contractor, and referral partner all touch the same opportunity.\n\nWithout a clean record, the deal can turn into a mess.\n\nDealVault is for the moments where everyone needs clarity around:\n- Referral source\n- Partner roles\n- Payout splits\n- Milestones\n- Proof uploads\n- Status changes\n\nCleaner records create cleaner partnerships.\n\nExplore DealVault: https://vestblock.io/dealvault\n\n#RealEstateDeals #Partnerships #DealVault",
  },
  {
    theme: "seller CTA",
    type: "direct response",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Have a property that feels stuck?\n\nMaybe it needs repairs.\nMaybe taxes are behind.\nMaybe the seller wants speed.\nMaybe the payoff makes a regular sale difficult.\nMaybe a creative or novation review would be worth discussing.\n\nVestBlock captures the details and routes the file for the most realistic next conversation.\n\nSubmit your property: https://vestblock.io/sell\n\n#SellMyHouse #RealEstateHelp #PropertyOwners",
  },
  {
    theme: "buyer CTA",
    type: "direct response",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "If you are buying in 2026, your buy box should be clear before the deal shows up.\n\nWhat markets?\nWhat price range?\nWhat asset type?\nHow much rehab?\nWhat closing speed?\nWhat proof or funding path?\nWhat is an automatic no?\n\nVestBlock uses that information to understand fit before making introductions.\n\nSubmit your buy box: https://vestblock.io/buyers\n\n#BuyBox #RealEstateBuyers #InvestorDeals",
  },
  {
    theme: "lender CTA",
    type: "direct response",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Private lenders, DSCR lenders, bridge lenders, and hard money lenders:\n\nIf you want better-fit real estate conversations, your lending box needs to be clear.\n\nVestBlock is collecting lender criteria so we can route borrower and deal opportunities with more discipline.\n\nShare your lending box: https://vestblock.io/lenders\n\nNo guaranteed volume, approvals, terms, or closed loans. Just cleaner routing.\n\n#PrivateLenders #DSCR #HardMoney",
  },
  {
    theme: "visibility",
    type: "pain point",
    audience: "members",
    link: "https://vestblock.io/visibility-expansion",
    text: "A buyer can have capital and still be invisible.\n\nA lender can have great programs and still be hard to understand.\n\nA contractor can be excellent and still miss project opportunities because nobody sees the right proof.\n\nVestBlock visibility campaigns help members make their profile, criteria, services, and proof easier to discover.\n\nExplore visibility: https://vestblock.io/visibility-expansion\n\n#RealEstateSEO #AEO #LocalBusinessGrowth",
  },
  {
    theme: "NLC",
    type: "education",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "No Limit Capital gives VestBlock buyers another tool when the deal is real but the capital path needs to be organized.\n\nInvestor files may include:\n- Fix and flip\n- Bridge\n- DSCR rental\n- Ground-up construction\n\nVestBlock helps package context. NLC reviews eligibility and terms.\n\nStart here: https://vestblock.io/real-estate-funding\n\n#NoLimitCapital #RealEstateCapital #InvestorFunding",
  },
  {
    theme: "proof",
    type: "education",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "Proof is not just for closing.\n\nProof helps before the deal too:\n- Who introduced the opportunity?\n- What was the original agreement?\n- What documents were shared?\n- What milestones matter?\n- What payout was expected?\n\nVestBlock is building DealVault so serious partners can keep cleaner records from the start.\n\nLearn more: https://vestblock.io/dealvault\n\n#RealEstateProof #DealRecords #PartnerPay",
  },
  {
    theme: "pain point",
    type: "problem agitation",
    audience: "all",
    link: "https://vestblock.io",
    text: "Real estate opportunities often fail for boring reasons:\n\nThe buyer was wrong.\nThe lender did not fit.\nThe seller path was unclear.\nThe partner agreement was not documented.\nThe capital stack was not ready.\nThe follow-up got lost.\n\nVestBlock exists to organize those moving parts.\n\nConnect. Route. Fund. Build.\n\nhttps://vestblock.io\n\n#RealEstate #PropTech #DealFlow",
  },
  {
    theme: "seller",
    type: "question",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Question for property owners:\n\nIf you knew you could review multiple paths before deciding, would you feel less pressure around selling?\n\nVestBlock seller intake is built to look at the situation first, including cash, creative, novation, and partner-fit paths.\n\nSubmit details: https://vestblock.io/sell\n\n#PropertyOwner #RealEstateOptions #SellAHouse",
  },
  {
    theme: "buyer education",
    type: "checklist",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "A stronger buyer profile answers these questions before the first deal is sent:\n\n1. Where do you buy?\n2. What do you buy?\n3. What price range works?\n4. What repairs are acceptable?\n5. How do you fund?\n6. What proof can you provide?\n7. What deal types are a no?\n\nVestBlock uses this to reduce mismatched deal flow.\n\nShare your profile: https://vestblock.io/buyers\n\n#RealEstateInvesting #BuyBox #DealFlow",
  },
  {
    theme: "capital",
    type: "scenario",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Scenario: You find a strong flip, but the seller needs speed and your capital stack is not fully lined up.\n\nThat is where deal packaging matters.\n\nVestBlock can help collect the purchase price, rehab budget, ARV, experience, liquidity, timeline, and exit plan so the file can be reviewed by No Limit Capital or another better-fit lender.\n\nStart funding review: https://vestblock.io/real-estate-funding\n\n#FixAndFlip #HardMoney #RealEstateFunding",
  },
  {
    theme: "contractors",
    type: "network",
    audience: "contractors",
    link: "https://vestblock.io",
    text: "Contractors and builders are part of the real estate deal ecosystem.\n\nA distressed property may need a buyer.\nA buyer may need a contractor.\nA lender may need scope clarity.\nA developer may need local support.\n\nVestBlock is building the network layer that can connect those conversations with cleaner context.\n\nStart here: https://vestblock.io\n\n#Contractors #ConstructionBusiness #RealEstateProjects",
  },
  {
    theme: "DealVault",
    type: "myth",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "Myth: Partner records only matter after a deal closes.\n\nReality: the record matters as soon as people start contributing value.\n\nIntroductions, documents, milestones, scope, payout terms, and status changes all become harder to track later.\n\nDealVault is built for cleaner accountability.\n\nhttps://vestblock.io/dealvault\n\n#DealVault #PartnerRecords #RealEstate",
  },
  {
    theme: "lender education",
    type: "checklist",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Lender criteria worth clarifying:\n\n- Minimum loan amount\n- Maximum loan amount\n- States served\n- Asset classes\n- First-time investor rules\n- Credit minimums\n- DSCR targets\n- Rehab budget rules\n- No-go property types\n- Preferred borrower profile\n\nVestBlock uses the box to route better-fit opportunities.\n\nJoin here: https://vestblock.io/lenders\n\n#RealEstateLending #PrivateMoney #LenderNetwork",
  },
  {
    theme: "AEO",
    type: "education",
    audience: "members",
    link: "https://vestblock.io/visibility-expansion",
    text: "AEO means answer engine optimization.\n\nIn plain English: when people ask AI tools or search engines who buys, lends, builds, funds, or solves a certain real estate problem in a market, your business should be easier to understand and cite.\n\nVestBlock visibility campaigns help members build that clarity.\n\nhttps://vestblock.io/visibility-expansion\n\n#AEO #AIVisibility #RealEstateMarketing",
  },
  {
    theme: "seller trust",
    type: "education",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "A property review should not start with pressure.\n\nIt should start with facts:\n- Property address\n- Condition\n- Timeline\n- Mortgage or payoff situation\n- Tax or code issues\n- Desired outcome\n- Flexibility\n\nVestBlock uses the facts to route the next conversation.\n\nSubmit a property: https://vestblock.io/sell\n\n#RealEstateReview #PropertyOwners #SellMyHouse",
  },
  {
    theme: "buyer pain",
    type: "hot take",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Hot take: more deal flow is not always better.\n\nBetter deal flow is better.\n\nA buyer who wants vacant SFRs under $180k does not need commercial packages, tenant-heavy portfolios, and overpriced retail listings all day.\n\nVestBlock is built around criteria first.\n\nShare your buy box: https://vestblock.io/buyers\n\n#RealEstateDeals #CashBuyer #BuyBox",
  },
  {
    theme: "capital disclaimer",
    type: "trust",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Funding review is not a promise.\n\nIt is a path to organize the file and get it in front of the right capital conversation.\n\nNo Limit Capital and other lenders decide final eligibility, pricing, leverage, terms, appraisal requirements, and approvals.\n\nVestBlock helps make the deal easier to understand before that review.\n\nhttps://vestblock.io/real-estate-funding\n\n#RealEstateFunding #InvestorCapital #DSCR",
  },
  {
    theme: "partnerships",
    type: "network",
    audience: "partners",
    link: "https://vestblock.io",
    text: "VestBlock is interested in real estate partners who bring real value:\n\n- Buyers with clear criteria\n- Lenders with defined programs\n- Contractors with proof\n- Developers with capacity\n- Operators with market knowledge\n- Service partners who help deals move\n\nThe network gets stronger when the roles are clear.\n\nhttps://vestblock.io\n\n#RealEstatePartners #PropTech #BusinessDevelopment",
  },
  {
    theme: "deal routing",
    type: "education",
    audience: "all",
    link: "https://vestblock.io",
    text: "Deal routing means the opportunity does not get treated the same every time.\n\nA vacant property may need a cash buyer.\nA rental may need DSCR review.\nA rehab may need NLC or hard money review.\nA referral-heavy deal may need DealVault.\nA strong buyer may need visibility support.\n\nVestBlock routes based on context.\n\nhttps://vestblock.io\n\n#DealRouting #RealEstate #VestBlock",
  },
  {
    theme: "seller",
    type: "scenario",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Scenario: The seller wants to move fast, but the property needs work and the number may not fit a simple cash offer.\n\nThat does not mean the conversation is over.\n\nCreative structure or novation review may still be worth looking at if the numbers, title, payoff, and timeline make sense.\n\nSubmit details: https://vestblock.io/sell\n\n#CreativeFinance #Novation #RealEstateOptions",
  },
  {
    theme: "buyer",
    type: "story",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "The best buyers usually know what they do not want.\n\nThat is why the VestBlock buyer intake asks for no-go items.\n\nFlood zones, occupied properties, rural deals, structural issues, tiny margins, certain zip codes, title problems, heavy rehabs - whatever does not fit should be known upfront.\n\nCleaner no-go criteria saves everyone time.\n\nhttps://vestblock.io/buyers\n\n#RealEstateInvestors #BuyBox #OffMarket",
  },
  {
    theme: "NLC",
    type: "program education",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Fix-and-flip files need more than excitement.\n\nThey need a clear story:\n- Purchase price\n- Rehab scope\n- ARV\n- Experience\n- Timeline\n- Exit strategy\n- Liquidity\n\nVestBlock can help organize that story before routing a qualified file toward No Limit Capital review.\n\nhttps://vestblock.io/real-estate-funding\n\n#FixAndFlip #RehabLoan #InvestorFunding",
  },
  {
    theme: "NLC",
    type: "program education",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Bridge financing is usually about timing and clarity.\n\nWhat is the property worth today?\nWhat is the exit?\nHow fast does it need to close?\nIs this purchase, refinance, or cash-out?\nWhat risks need to be explained?\n\nVestBlock helps organize the file before capital review.\n\nhttps://vestblock.io/real-estate-funding\n\n#BridgeLoan #RealEstateFunding #InvestorDeals",
  },
  {
    theme: "NLC",
    type: "program education",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "DSCR funding starts with the property's rental story.\n\nA stronger review usually needs:\n- Rent estimate\n- Property value\n- Purchase or refinance details\n- Borrower credit range\n- Entity or vesting info\n- Taxes, insurance, and HOA context\n\nVestBlock helps organize the file before routing it for review.\n\nhttps://vestblock.io/real-estate-funding\n\n#DSCR #RentalProperty #RealEstateInvesting",
  },
  {
    theme: "construction",
    type: "program education",
    audience: "developers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Ground-up construction needs a different level of clarity.\n\nCapital partners want to understand experience, budget, timeline, exit, value, contractor readiness, and project risk.\n\nVestBlock can help organize qualified construction scenarios for partner review.\n\nhttps://vestblock.io/real-estate-funding\n\n#GroundUpConstruction #RealEstateDevelopment #BuilderFinance",
  },
  {
    theme: "SEO/AEO",
    type: "service",
    audience: "buyers",
    link: "https://vestblock.io/visibility-expansion",
    text: "If you are a serious buyer, your public profile should answer basic questions:\n\nWhat do you buy?\nWhere do you buy?\nHow do sellers contact you?\nWhat proof can you show?\nWhat makes you credible?\nWhat deals do you not want?\n\nVestBlock visibility campaigns help turn that into clearer search and AI signals.\n\nhttps://vestblock.io/visibility-expansion\n\n#RealEstateSEO #CashBuyerMarketing #AEO",
  },
  {
    theme: "SEO/AEO",
    type: "service",
    audience: "lenders",
    link: "https://vestblock.io/visibility-expansion",
    text: "Private lenders should be easy to understand before a borrower calls.\n\nMarkets served.\nLoan types.\nMinimums.\nProperty types.\nBorrower fit.\nNo-go deals.\nDocumentation expectations.\n\nVestBlock can help lenders build clearer program visibility with SEO/AEO support.\n\nhttps://vestblock.io/visibility-expansion\n\n#PrivateLenderMarketing #AEO #RealEstateLending",
  },
  {
    theme: "DealVault",
    type: "pain point",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "The phrase that creates problems later:\n\n'We will figure the split out after it closes.'\n\nSometimes that works. Often it does not.\n\nDealVault is built for cleaner partner records before memories, texts, and assumptions become the only evidence.\n\nhttps://vestblock.io/dealvault\n\n#PartnerPay #DealVault #RealEstatePartnerships",
  },
  {
    theme: "seller",
    type: "FAQ",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Can VestBlock buy every property?\n\nNo.\n\nSome properties may fit a fast cash review. Some may fit creative or novation review. Some may need a buyer, lender, contractor, or partner conversation. Some may not fit at all.\n\nThe first step is getting the facts into the system.\n\nSubmit property details: https://vestblock.io/sell\n\n#PropertyReview #SellMyHouse #RealEstateOptions",
  },
  {
    theme: "buyer",
    type: "FAQ",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Do buyers have to be huge funds to join VestBlock?\n\nNo.\n\nLocal cash buyers, landlords, fix-and-flip operators, creative buyers, land buyers, multifamily buyers, commercial buyers, and institutional teams can all submit criteria.\n\nThe key is knowing what you actually want.\n\nhttps://vestblock.io/buyers\n\n#LocalCashBuyer #RealEstateInvestor #BuyBox",
  },
  {
    theme: "lender",
    type: "FAQ",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Does VestBlock guarantee funded loans?\n\nNo.\n\nVestBlock is not a lender and does not guarantee approvals, terms, rates, or volume.\n\nThe purpose is to collect lender criteria and route better-fit real estate opportunities for manual review.\n\nJoin here: https://vestblock.io/lenders\n\n#LenderNetwork #PrivateMoney #RealEstateFunding",
  },
  {
    theme: "partners",
    type: "relationship",
    audience: "partners",
    link: "https://vestblock.io",
    text: "Good partners make real estate easier to execute.\n\nA strong contractor can save a rehab.\nA strong lender can save a closing.\nA strong buyer can save a seller timeline.\nA strong record can save the relationship.\n\nVestBlock is building for all four.\n\nhttps://vestblock.io\n\n#RealEstatePartners #DealFlow #PropTech",
  },
  {
    theme: "seller pain",
    type: "problem",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "When a property has unpaid taxes, code issues, repairs, or title questions, the seller usually does not need hype.\n\nThey need a realistic review.\n\nVestBlock intake captures the important context so the next conversation can be routed more intelligently.\n\nSubmit a property: https://vestblock.io/sell\n\n#DistressedProperty #PropertyOwners #RealEstateSolutions",
  },
  {
    theme: "buyer capital",
    type: "offer",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Buyers: if you want VestBlock to send you real opportunities, make the capital picture clear too.\n\nCash?\nPrivate money?\nDSCR?\nBridge?\nFix-and-flip funding?\nGround-up construction funding?\n\nWith No Limit Capital in the network, VestBlock can help qualified files move into a more serious funding review.\n\nhttps://vestblock.io/real-estate-funding\n\n#RealEstateBuyer #NoLimitCapital #DealFunding",
  },
  {
    theme: "operator",
    type: "education",
    audience: "operators",
    link: "https://vestblock.io",
    text: "A real estate operator's edge is often not one thing.\n\nIt is deal flow plus capital plus execution plus proof plus visibility.\n\nVestBlock is building around those five layers:\n1. Seller intake\n2. Buyer and lender criteria\n3. Capital partner paths\n4. DealVault records\n5. SEO/AEO visibility support\n\nhttps://vestblock.io\n\n#RealEstateOperator #PropTech #VestBlock",
  },
  {
    theme: "case framing",
    type: "mini case",
    audience: "all",
    link: "https://vestblock.io",
    text: "Mini case:\n\nA seller submits a property.\nA buyer's buy box matches.\nThe buyer needs leverage.\nThe file may fit No Limit Capital review.\nThe partner roles can be tracked in DealVault.\nThe buyer can build visibility for future seller credibility.\n\nThat is the VestBlock angle.\n\nhttps://vestblock.io\n\n#RealEstateDealFlow #Funding #DealVault",
  },
  {
    theme: "DealVault",
    type: "CTA",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "If you work with partners, ask this before the next deal:\n\nHow will we prove who did what?\n\nIf the answer is scattered texts, screenshots, and memory, there is a better way coming.\n\nDealVault is VestBlock's proof layer for real estate partnerships.\n\nhttps://vestblock.io/dealvault\n\n#DealVault #ProofLayer #RealEstateTech",
  },
  {
    theme: "buyer",
    type: "question",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Buyers, what would make a deal easier for you to review?\n\nMore photos?\nCleaner rehab scope?\nSeller timeline?\nRent estimate?\nARV support?\nProof of title status?\nCapital review path?\n\nVestBlock is building around better deal context, not just more addresses.\n\nShare your buy box: https://vestblock.io/buyers\n\n#RealEstateInvestors #DealReview #Buyers",
  },
  {
    theme: "seller",
    type: "question",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Property owners: what matters most if you are considering selling?\n\nSpeed?\nCertainty?\nPrice?\nAvoiding repairs?\nAvoiding showings?\nSolving taxes or code issues?\nUnderstanding creative options?\n\nVestBlock starts with the situation, then routes the next conversation.\n\nhttps://vestblock.io/sell\n\n#PropertyOwners #SellMyHouse #RealEstate",
  },
  {
    theme: "lenders",
    type: "question",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Lenders: what makes a real estate file worth your time?\n\nStrong borrower?\nClear exit?\nGood collateral?\nEnough liquidity?\nClean title?\nRight market?\nRight loan size?\n\nVestBlock wants lender criteria upfront so files can be routed with more respect for your box.\n\nhttps://vestblock.io/lenders\n\n#RealEstateLenders #BridgeLending #DSCR",
  },
  {
    theme: "NLC",
    type: "trust",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "No Limit Capital gives us something important to offer qualified buyers right away: a real capital review path.\n\nThat does not mean every file gets funded.\n\nIt means VestBlock can package stronger investor deals for review across several lanes, including fix-and-flip, bridge, DSCR, and ground-up construction.\n\nhttps://vestblock.io/real-estate-funding\n\n#NoLimitCapital #InvestorFunding #RealEstate",
  },
  {
    theme: "visibility",
    type: "why",
    audience: "members",
    link: "https://vestblock.io/visibility-expansion",
    text: "Why add visibility campaigns to a real estate network?\n\nBecause the best partner is easier to trust when their public presence is clear.\n\nIf a seller searches a buyer, what do they find?\nIf a borrower searches a lender, what do they understand?\nIf AI tools summarize your company, is the answer accurate?\n\nVestBlock can help members build that clarity.\n\nhttps://vestblock.io/visibility-expansion",
  },
  {
    theme: "contractor",
    type: "pain point",
    audience: "contractors",
    link: "https://vestblock.io",
    text: "Contractors lose opportunities when they only show up after the deal is already messy.\n\nThe better move is being part of the network before scope, rehab budget, and funding review become urgent.\n\nVestBlock is building room for contractors and builders in the real estate opportunity flow.\n\nhttps://vestblock.io\n\n#ContractorMarketing #RealEstateRehab #Construction",
  },
  {
    theme: "developer",
    type: "pain point",
    audience: "developers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Developers need more than a property address.\n\nThey need project context, capital context, builder experience, timeline, exit, and partner clarity.\n\nVestBlock can support ground-up and development conversations by organizing the file before review.\n\nhttps://vestblock.io/real-estate-funding\n\n#RealEstateDevelopment #GroundUpConstruction #Capital",
  },
  {
    theme: "seller",
    type: "education",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Fast cash, creative, and novation are not the same thing.\n\nA cash review usually focuses on speed and discount.\nCreative structure may focus on terms.\nNovation may focus on improving the property's market path with an agreement in place.\n\nThe right path depends on the numbers and facts.\n\nStart with the property: https://vestblock.io/sell\n\n#CreativeFinance #Novation #CashOffer",
  },
  {
    theme: "buyer",
    type: "education",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "A buy box should be specific enough to say no.\n\nIf every deal technically fits, no deal really fits.\n\nVestBlock buyer intake is built to capture the edges: where you buy, what you avoid, what funding you use, what proof you have, and how you prefer opportunities routed.\n\nhttps://vestblock.io/buyers\n\n#BuyBox #InvestorCriteria #RealEstate",
  },
  {
    theme: "funding",
    type: "checklist",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Funding review checklist:\n\n- Credit range\n- Liquidity\n- Purchase price\n- Rehab budget\n- ARV or value\n- Rent estimate for DSCR\n- Exit strategy\n- Timeline\n- Experience\n- Contract status\n\nThe clearer the file, the better the review conversation.\n\nhttps://vestblock.io/real-estate-funding\n\n#FundingChecklist #RealEstateCapital #DSCR",
  },
  {
    theme: "DealVault",
    type: "education",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "DealVault is not trying to replace relationships.\n\nIt is trying to protect them.\n\nClear records make it easier to work with people again because the agreement, proof, milestones, and payouts are not left to memory.\n\nhttps://vestblock.io/dealvault\n\n#DealVault #RealEstatePartnerships #Trust",
  },
  {
    theme: "network",
    type: "vision",
    audience: "all",
    link: "https://vestblock.io",
    text: "VestBlock's network flywheel:\n\nSellers bring opportunities.\nBuyers bring buy boxes.\nLenders bring criteria.\nCapital partners bring funding paths.\nContractors bring execution.\nDealVault brings proof.\nVisibility campaigns help the best members get found.\n\nThat is how the network compounds.\n\nhttps://vestblock.io\n\n#PropTech #RealEstateNetwork #VestBlock",
  },
  {
    theme: "seller pain",
    type: "empathy",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Selling a property can feel confusing when every buyer says they are the solution.\n\nVestBlock is taking a different approach: collect the facts, review the possible paths, and route the right conversation.\n\nNo pressure. No guaranteed outcome. Just a clearer starting point.\n\nhttps://vestblock.io/sell\n\n#SellAHouse #PropertyReview #RealEstateHelp",
  },
  {
    theme: "buyer pain",
    type: "empathy",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Buyers are tired of seeing the same recycled deals with missing context.\n\nVestBlock's goal is to make the front end cleaner:\n- Seller situation\n- Property details\n- Buyer criteria\n- Capital readiness\n- Partner proof where needed\n\nBetter context creates better conversations.\n\nhttps://vestblock.io/buyers\n\n#RealEstateBuyer #OffMarket #DealFlow",
  },
  {
    theme: "lender pain",
    type: "empathy",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Lenders are not short on inquiries.\n\nThey are short on well-matched inquiries.\n\nVestBlock lender intake is built around criteria so we can understand what should and should not be routed to a lending partner.\n\nShare your lending box: https://vestblock.io/lenders\n\n#PrivateLending #LenderCriteria #RealEstateFunding",
  },
  {
    theme: "NLC",
    type: "comparison",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Cash is powerful, but not every buyer wants to use only cash on every deal.\n\nSome files need leverage.\nSome need rehab capital.\nSome need bridge timing.\nSome need DSCR review.\nSome need construction capital.\n\nNo Limit Capital gives VestBlock a partner path for qualified investor files.\n\nhttps://vestblock.io/real-estate-funding\n\n#InvestorCapital #NoLimitCapital #RealEstateFunding",
  },
  {
    theme: "SEO/AEO",
    type: "education",
    audience: "members",
    link: "https://vestblock.io/visibility-expansion",
    text: "AI visibility will matter in real estate.\n\nWhen someone asks an AI tool:\n'Who buys houses in this market?'\n'Who funds flips?'\n'Who handles distressed property projects?'\n'Who is a real estate partner network?'\n\nYou want the answer to understand your company correctly.\n\nVestBlock helps members build that foundation.\n\nhttps://vestblock.io/visibility-expansion",
  },
  {
    theme: "proof",
    type: "pain point",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "The worst time to create a clean record is after everyone is already arguing.\n\nDealVault is for creating proof earlier:\n- Deal created\n- Partner added\n- Document attached\n- Milestone updated\n- Payout terms recorded\n\nCleaner deal records. Better partner trust.\n\nhttps://vestblock.io/dealvault\n\n#DealVault #Proof #PartnerTrust",
  },
  {
    theme: "seller",
    type: "CTA",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "If you have a property in Milwaukee, Toledo, Memphis, or another market and want to understand possible paths, start with the details.\n\nFast cash review.\nCreative review.\nNovation review.\nPartner-fit conversation.\n\nVestBlock routes from the facts.\n\nhttps://vestblock.io/sell\n\n#MilwaukeeRealEstate #ToledoRealEstate #MemphisRealEstate",
  },
  {
    theme: "buyer",
    type: "CTA",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "We are building the buyer side of VestBlock now.\n\nIf you are a cash buyer, landlord, flipper, creative buyer, multifamily buyer, commercial buyer, or institutional buyer, submit your buy box.\n\nThe clearer the criteria, the better we can route opportunities.\n\nhttps://vestblock.io/buyers\n\n#CashBuyers #Landlords #FixAndFlip",
  },
  {
    theme: "lender",
    type: "CTA",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "If you lend on real estate, VestBlock wants your criteria.\n\nNot for spam.\nNot for random files.\n\nFor better routing when the borrower, property, market, and deal type line up with what you actually fund.\n\nJoin here: https://vestblock.io/lenders\n\n#DSCRLender #BridgeLender #HardMoney",
  },
  {
    theme: "construction",
    type: "CTA",
    audience: "contractors",
    link: "https://vestblock.io",
    text: "Contractors, builders, and project operators: the network needs execution partners too.\n\nIf a buyer has a deal but no scope, the file is weaker.\nIf a lender has no budget clarity, the file is weaker.\nIf a seller has repairs but no plan, the path is weaker.\n\nExecution matters.\n\nhttps://vestblock.io\n\n#Contractors #Builders #RealEstateProjects",
  },
  {
    theme: "capital",
    type: "FAQ",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Does VestBlock set No Limit Capital terms?\n\nNo.\n\nVestBlock can organize and route qualified deal context. No Limit Capital determines final eligibility, pricing, leverage, terms, appraisal requirements, and approvals.\n\nThe value is getting the file into a cleaner review path.\n\nhttps://vestblock.io/real-estate-funding\n\n#NoLimitCapital #RealEstateFunding",
  },
  {
    theme: "operator",
    type: "framework",
    audience: "operators",
    link: "https://vestblock.io",
    text: "The VestBlock framework:\n\nConnect: bring the right people into the network.\nRoute: match seller, buyer, lender, and operator context.\nFund: organize qualified files for capital review.\nBuild: support execution, proof, and visibility.\n\nThis is more than a lead form.\n\nhttps://vestblock.io\n\n#VestBlock #PropTech #RealEstate",
  },
  {
    theme: "seller",
    type: "plain language",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Plain English:\n\nIf you have a property and do not know whether cash, creative, novation, or another path makes sense, VestBlock can capture the details and route it for review.\n\nYou do not need to know the perfect strategy before you submit.\n\nStart here: https://vestblock.io/sell\n\n#RealEstateOptions #PropertyOwner #SellMyHouse",
  },
  {
    theme: "buyer",
    type: "plain language",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Plain English:\n\nIf you buy real estate, tell VestBlock exactly what you buy.\n\nThen when seller opportunities come through, we have a better chance of knowing who should see what.\n\nSubmit your buy box: https://vestblock.io/buyers\n\n#RealEstateBuyer #BuyBox #OffMarketDeals",
  },
  {
    theme: "funding",
    type: "plain language",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Plain English:\n\nIf you have a real estate deal and need funding review, VestBlock can help package the context for No Limit Capital or another better-fit lender.\n\nIt is not a guarantee. It is a cleaner path to review.\n\nhttps://vestblock.io/real-estate-funding\n\n#RealEstateFunding #FixAndFlip #DSCR",
  },
  {
    theme: "DealVault",
    type: "plain language",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "Plain English:\n\nDealVault helps real estate partners keep better records around deals, referrals, milestones, proof, and payouts.\n\nBecause good partnerships should not depend on scattered screenshots.\n\nhttps://vestblock.io/dealvault\n\n#DealVault #RealEstatePartners #ProofLayer",
  },
  {
    theme: "visibility",
    type: "plain language",
    audience: "members",
    link: "https://vestblock.io/visibility-expansion",
    text: "Plain English:\n\nVestBlock can help buyers, lenders, operators, and partners explain what they do online so sellers, borrowers, partners, search engines, and AI tools understand them better.\n\nThat is the visibility angle.\n\nhttps://vestblock.io/visibility-expansion\n\n#AEO #SEO #RealEstateMarketing",
  },
  {
    theme: "network",
    type: "recap",
    audience: "all",
    link: "https://vestblock.io",
    text: "What VestBlock offers right now:\n\n- Seller property review\n- Buyer buy-box intake\n- Lender criteria intake\n- Real estate funding review\n- No Limit Capital partner path\n- DealVault proof records\n- Member SEO/AEO visibility support\n- Partner network growth\n\nThe angle is simple: connect the right people around better real estate opportunities.\n\nhttps://vestblock.io",
  },
  {
    theme: "seller objection",
    type: "objection handling",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Objection: 'My property is too complicated.'\n\nThat may be exactly why it needs review.\n\nRepairs, taxes, timing, payoff, code issues, tenants, and title questions all change the path. VestBlock intake is built to collect context before the next conversation.\n\nhttps://vestblock.io/sell\n\n#DistressedProperty #RealEstateHelp",
  },
  {
    theme: "buyer objection",
    type: "objection handling",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Objection: 'I already get deal flow.'\n\nGood. Then the question is: does your current deal flow match your actual buy box?\n\nVestBlock is not trying to send everything. The goal is to route better-fit opportunities with clearer context.\n\nhttps://vestblock.io/buyers\n\n#DealFlow #CashBuyer #RealEstateInvestor",
  },
  {
    theme: "lender objection",
    type: "objection handling",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Objection: 'We already have borrowers.'\n\nGreat. VestBlock is not built to replace your pipeline.\n\nIt is built to route better-fit real estate opportunities when the borrower, property, market, and deal type match your lending box.\n\nhttps://vestblock.io/lenders\n\n#PrivateLending #HardMoney #DSCR",
  },
  {
    theme: "capital objection",
    type: "objection handling",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Objection: 'I do not want to waste time with funding review.'\n\nThen organize the file before you send it.\n\nPurchase price, rehab, ARV, rent, exit, liquidity, timeline, and experience can make the conversation clearer from the start.\n\nVestBlock helps with that packaging.\n\nhttps://vestblock.io/real-estate-funding",
  },
  {
    theme: "DealVault objection",
    type: "objection handling",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "Objection: 'We trust each other.'\n\nGood records do not mean a lack of trust.\n\nThey mean everyone respects the relationship enough to document the agreement, milestones, proof, and payout expectations clearly.\n\nThat is why DealVault exists.\n\nhttps://vestblock.io/dealvault",
  },
  {
    theme: "weekly prompt",
    type: "engagement",
    audience: "all",
    link: "https://vestblock.io",
    text: "Real estate question:\n\nWhat breaks more deals in your experience?\n\nA. Seller expectations\nB. Buyer capital\nC. Lender criteria\nD. Rehab scope\nE. Partner communication\n\nVestBlock is building around all five.\n\nhttps://vestblock.io\n\n#RealEstateQuestion #DealFlow",
  },
  {
    theme: "weekly prompt",
    type: "engagement",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Buyers: what is your fastest no?\n\n- Bad title\n- Too much rehab\n- Wrong zip code\n- Tenant occupied\n- Bad numbers\n- Too rural\n- No clear exit\n- Funding does not fit\n\nYour no-go list is part of your buy box.\n\nSubmit it here: https://vestblock.io/buyers",
  },
  {
    theme: "weekly prompt",
    type: "engagement",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Lenders: what is the most common reason a file is not ready?\n\nCredit?\nLiquidity?\nCollateral?\nExit strategy?\nBorrower experience?\nMissing documents?\nWrong loan size?\n\nVestBlock wants lender criteria upfront so files get cleaner before review.\n\nhttps://vestblock.io/lenders",
  },
  {
    theme: "weekly prompt",
    type: "engagement",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Property owners: if you had to sell, what would matter most?\n\nSpeed, price, certainty, no repairs, fewer showings, help with a difficult situation, or understanding creative options?\n\nVestBlock starts by reviewing the path.\n\nhttps://vestblock.io/sell",
  },
  {
    theme: "weekly prompt",
    type: "engagement",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "Partners: what should always be documented before a deal gets too far?\n\nReferral source?\nPayout split?\nScope?\nDecision maker?\nFunding path?\nMilestones?\nDocument access?\n\nDealVault is being built for this exact problem.\n\nhttps://vestblock.io/dealvault",
  },
  {
    theme: "weekly prompt",
    type: "engagement",
    audience: "buyers",
    link: "https://vestblock.io/real-estate-funding",
    text: "Investor buyers: which capital path matters most for your next 90 days?\n\nA. Fix and flip\nB. Bridge\nC. DSCR rental\nD. Ground-up construction\nE. Private cash only\n\nVestBlock can help package qualified files for No Limit Capital review.\n\nhttps://vestblock.io/real-estate-funding",
  },
  {
    theme: "authority",
    type: "founder voice",
    audience: "all",
    link: "https://vestblock.io",
    text: "The goal is not to make VestBlock another generic real estate website.\n\nThe goal is to build a network where opportunities can be reviewed, routed, funded, built, documented, and amplified with more discipline.\n\nThat is the business.\n\nhttps://vestblock.io\n\n#VestBlock #RealEstateNetwork #PropTech",
  },
  {
    theme: "authority",
    type: "founder voice",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "I do not want buyers in the VestBlock network just saying 'send me deals.'\n\nI want clear criteria.\n\nMarkets. Numbers. Funding. Proof. Speed. No-go items. Deal types.\n\nThat is how we build a network that respects everyone's time.\n\nhttps://vestblock.io/buyers",
  },
  {
    theme: "authority",
    type: "founder voice",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "For sellers, the offer path should fit the situation.\n\nFast cash, creative, and novation are different tools. The goal is to review the facts and see what is realistic, not force every property into one box.\n\nSubmit here: https://vestblock.io/sell",
  },
  {
    theme: "authority",
    type: "founder voice",
    audience: "capital",
    link: "https://vestblock.io/real-estate-funding",
    text: "Adding No Limit Capital matters because buyers need more than motivation.\n\nThey need a capital path when the file is strong enough to review.\n\nVestBlock can now pair seller opportunities, buyer criteria, and partner funding review in a much stronger way.\n\nhttps://vestblock.io/real-estate-funding",
  },
  {
    theme: "authority",
    type: "founder voice",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "DealVault is a long-term piece of the VestBlock vision.\n\nIf we are going to connect people around real estate opportunities, we also need a cleaner way to record agreements, proof, milestones, and payouts.\n\nThat is how the network earns trust.\n\nhttps://vestblock.io/dealvault",
  },
  {
    theme: "summary",
    type: "weekly roundup",
    audience: "all",
    link: "https://vestblock.io",
    text: "This week at VestBlock, the message is simple:\n\nSellers: submit the property.\nBuyers: submit the buy box.\nLenders: submit the lending box.\nOperators: bring execution.\nCapital partners: review the right files.\nDealVault: keep the proof clean.\nVisibility: make the network easier to find.\n\nhttps://vestblock.io",
  },
  {
    theme: "summary",
    type: "weekly roundup",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "Buyer reminder:\n\nA clear buy box plus a clear capital path is stronger than either one alone.\n\nIf you buy real estate, submit your criteria and tell VestBlock how you fund deals.\n\nhttps://vestblock.io/buyers\n\n#BuyBox #RealEstateFunding #Investors",
  },
  {
    theme: "summary",
    type: "weekly roundup",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Seller reminder:\n\nYou do not need to guess the best path before you submit.\n\nVestBlock can review the situation for fast cash, creative, novation, or another partner-fit conversation.\n\nhttps://vestblock.io/sell\n\n#PropertyReview #SellMyHouse",
  },
  {
    theme: "summary",
    type: "weekly roundup",
    audience: "lenders",
    link: "https://vestblock.io/lenders",
    text: "Lender reminder:\n\nIf you want better-fit deal conversations, give VestBlock the lending box.\n\nStates, loan sizes, credit rules, deal types, no-go items, and preferred borrower profile.\n\nhttps://vestblock.io/lenders\n\n#LenderNetwork #PrivateMoney",
  },
  {
    theme: "summary",
    type: "weekly roundup",
    audience: "partners",
    link: "https://vestblock.io",
    text: "Partner reminder:\n\nVestBlock is not just a seller form.\n\nIt is becoming a partner network for buyers, lenders, operators, contractors, developers, capital partners, and deal proof.\n\nIf your business helps real estate opportunities move, there may be a fit.\n\nhttps://vestblock.io",
  },
  {
    theme: "final CTA",
    type: "conversion",
    audience: "all",
    link: "https://vestblock.io/get-started",
    text: "Not sure where you fit in VestBlock?\n\nStart here:\n\nSeller: property review\nBuyer: buy-box intake\nLender: lending criteria\nInvestor: funding review\nPartner: DealVault or visibility support\nOperator: network conversation\n\nChoose your path: https://vestblock.io/get-started\n\n#VestBlock #RealEstate #PropTech",
  },
  {
    theme: "final CTA",
    type: "conversion",
    audience: "buyers",
    link: "https://vestblock.io/buyers",
    text: "If you are a buyer and want to be taken seriously, make your criteria easy to understand.\n\nVestBlock buyer intake is open.\n\nSubmit markets, asset types, price range, proof, funding path, preferred deals, and no-go items.\n\nhttps://vestblock.io/buyers\n\n#RealEstateBuyer #BuyBox",
  },
  {
    theme: "final CTA",
    type: "conversion",
    audience: "capital",
    link: "https://vestblock.io/real-estate-funding",
    text: "Have a deal that may need fix-and-flip, bridge, DSCR, or ground-up construction funding review?\n\nVestBlock can help organize the context and route qualified files toward No Limit Capital or another better-fit partner.\n\nhttps://vestblock.io/real-estate-funding\n\n#RealEstateFunding #InvestorCapital",
  },
  {
    theme: "final CTA",
    type: "conversion",
    audience: "sellers",
    link: "https://vestblock.io/sell",
    text: "Have a property that may need a cash, creative, novation, or partner-fit review?\n\nStart with the property details.\n\nVestBlock will route the conversation from there.\n\nhttps://vestblock.io/sell\n\nNo guaranteed offer, price, timeline, or closing.\n\n#SellMyHouse #PropertyReview",
  },
  {
    theme: "final CTA",
    type: "conversion",
    audience: "partners",
    link: "https://vestblock.io/dealvault",
    text: "If deals involve multiple partners, proof matters.\n\nDealVault is VestBlock's record layer for agreements, referrals, milestones, documents, and payouts.\n\nExplore it here: https://vestblock.io/dealvault\n\n#DealVault #RealEstatePartners",
  },
  {
    theme: "final CTA",
    type: "conversion",
    audience: "members",
    link: "https://vestblock.io/visibility-expansion",
    text: "If your real estate business needs clearer market visibility, VestBlock can help with SEO/AEO campaigns designed around your role in the network.\n\nBuyers. Lenders. Operators. Partners. Service providers.\n\nMake the profile easier to find and understand.\n\nhttps://vestblock.io/visibility-expansion\n\n#SEO #AEO #RealEstateMarketing",
  },
]

function centralMorningIso(index) {
  const [year, month, day] = START_DATE.split("-").map(Number)
  const startUtc = Date.UTC(year, month - 1, day, 14, 15, 0)
  return new Date(startUtc + index * 24 * 60 * 60 * 1000).toISOString()
}

function buildCalendar() {
  return posts.slice(0, 90).map((post, index) => ({
    day: index + 1,
    dueAt: centralMorningIso(index),
    channelId: FACEBOOK_CHANNEL_ID,
    channel: "VestBlock Facebook",
    ...post,
  }))
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function writeOutputs(calendar) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const cols = ["day", "dueAt", "channel", "theme", "type", "audience", "link", "text"]
  fs.writeFileSync(JSON_OUT, JSON.stringify(calendar, null, 2))
  fs.writeFileSync(CSV_OUT, [cols.join(","), ...calendar.map((row) => cols.map((col) => csvEscape(row[col])).join(","))].join("\n"))

  const teamMarkdown = [
    "# VestBlock Facebook Content Team",
    "",
    "This is the operating team for the 90-day Buffer content calendar.",
    "",
    ...contentTeam.map((member) => `## ${member.role}\n- Owner: ${member.owner}\n- Job: ${member.job}\n`),
    "## Publishing Rules",
    "- Never promise funding, approvals, rates, offers, closings, rankings, or deal volume.",
    "- Keep No Limit Capital framed as a partner review path, not a guarantee.",
    "- Keep VestBlock framed as a real estate partner network and routing layer, not a brokerage, lender, or closing agent.",
    "- Every post should point to one of the core paths: sellers, buyers, lenders, funding review, DealVault, visibility, or get started.",
    "- Use Facebook comments to ask clarifying questions and move qualified replies into the right VestBlock intake path.",
    "",
    "## Buffer Scheduling Notes",
    "- The scheduler uses Buffer's current GraphQL API and creates Facebook posts with `metadata.facebook.type: post`.",
    "- Live scheduling is intentionally batched with `--max=6` because Buffer returned a 15-minute rate-limit window after six creates.",
    "- Result files are used as the resume ledger. Re-running the scheduler skips days that already have Buffer post IDs, so it will continue without duplicating posts.",
    "- The API key is read from `BUFFER_API_KEY` at runtime and is not written into the repository.",
    "",
    `Calendar JSON: ${JSON_OUT}`,
    `Calendar CSV: ${CSV_OUT}`,
    "",
  ].join("\n")
  fs.writeFileSync(TEAM_OUT, teamMarkdown)
}

async function gql(apiKey, query) {
  const response = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  })
  const json = await response.json()
  if (json.errors) {
    return { ok: false, error: JSON.stringify(json.errors) }
  }
  const result = json.data?.createPost
  if (result?.message) return { ok: false, error: result.message }
  return { ok: true, post: result?.post || null }
}

function loadScheduledPostDays() {
  const scheduled = new Map()
  if (!fs.existsSync(OUT_DIR)) return scheduled

  for (const fileName of fs.readdirSync(OUT_DIR)) {
    if (!fileName.startsWith(RESULTS_PREFIX) || !fileName.endsWith(".json")) continue
    const filePath = path.join(OUT_DIR, fileName)
    try {
      const rows = JSON.parse(fs.readFileSync(filePath, "utf8"))
      if (!Array.isArray(rows)) continue

      for (const row of rows) {
        if (row?.ok && row?.postId && row?.day) {
          scheduled.set(row.day, {
            postId: row.postId,
            resultFile: fileName,
          })
        }
      }
    } catch {
      console.warn(`Skipping unreadable Buffer result file: ${fileName}`)
    }
  }

  return scheduled
}

function isRateLimitError(error) {
  return /RATE_LIMIT_EXCEEDED|too many requests|rate limit|15m/i.test(String(error || ""))
}

async function schedule(calendar) {
  if (!process.env.BUFFER_API_KEY) {
    throw new Error("Missing BUFFER_API_KEY.")
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const resultsPath = path.join(OUT_DIR, `vestblock-facebook-buffer-results-${stamp}.json`)
  const results = []
  const alreadyScheduled = loadScheduledPostDays()
  let sentThisRun = 0

  for (const item of calendar) {
    const previous = alreadyScheduled.get(item.day)
    if (previous) {
      results.push({
        day: item.day,
        dueAt: item.dueAt,
        theme: item.theme,
        ok: true,
        postId: previous.postId,
        skippedAlreadyScheduled: true,
        resultFile: previous.resultFile,
        error: null,
      })
      console.log(`skip ${item.day}/90 already scheduled ${previous.postId}`)
      continue
    }

    if (MAX_TO_SEND && sentThisRun >= MAX_TO_SEND) {
      console.log(`Reached --max=${MAX_TO_SEND}. Re-run after Buffer's rate window resets to continue.`)
      break
    }

    const text = item.text
    const query = `
      mutation CreatePost {
        createPost(input: {
          text: ${JSON.stringify(text)}
          channelId: ${JSON.stringify(item.channelId)}
          schedulingType: automatic
          mode: customScheduled
          dueAt: ${JSON.stringify(item.dueAt)}
          metadata: {
            facebook: {
              type: post
              linkAttachment: {
                url: ${JSON.stringify(item.link)}
              }
            }
          }
        }) {
          ... on PostActionSuccess {
            post {
              id
              text
            }
          }
          ... on MutationError {
            message
          }
        }
      }
    `

    const result = await gql(process.env.BUFFER_API_KEY, query)
    results.push({
      day: item.day,
      dueAt: item.dueAt,
      theme: item.theme,
      ok: result.ok,
      postId: result.post?.id || null,
      error: result.error || null,
    })
    console.log(`${result.ok ? "ok" : "failed"} ${item.day}/90 ${item.dueAt} ${result.ok ? result.post?.id || "" : result.error}`)
    if (result.ok) sentThisRun += 1
    if (!result.ok && isRateLimitError(result.error)) {
      console.log("Buffer rate limit reached. Stopping now so the next run can resume cleanly.")
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 350))
  }

  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2))
  return resultsPath
}

async function main() {
  if (posts.length < 90) {
    throw new Error(`Expected at least 90 posts, found ${posts.length}.`)
  }
  const calendar = buildCalendar()
  writeOutputs(calendar)

  console.log("VestBlock Buffer Facebook calendar")
  console.log(`Posts:       ${calendar.length}`)
  console.log(`Start:       ${START_DATE} at 9:15 AM America/Chicago`)
  console.log(`Channel ID:  ${FACEBOOK_CHANNEL_ID}`)
  console.log(`JSON:        ${JSON_OUT}`)
  console.log(`CSV:         ${CSV_OUT}`)
  console.log(`Team doc:    ${TEAM_OUT}`)

  if (!SEND) {
    console.log("Dry run only. Re-run with --send and BUFFER_API_KEY to schedule in Buffer.")
    return
  }

  const resultsPath = await schedule(calendar)
  console.log(`Results:     ${resultsPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
