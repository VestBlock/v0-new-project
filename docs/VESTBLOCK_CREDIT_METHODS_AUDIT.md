# VestBlock Credit Methods Audit

Last updated: 2026-04-30

## What VestBlock already had

- AI credit report analysis
- Dispute-letter generation
- 609 education
- Debt validation education
- Charge-off and collection dispute education
- Utilization and credit-builder education
- Dispute-letter reminder automation

## Strong compliance-safe methods added in this pass

These methods are grounded in consumer rights, documentation, and timing rather than guarantees:

1. Credit bureau dispute with documentation
   - Best when report data is inaccurate, incomplete, duplicated, or mixed.
   - Dispute with the bureau and the furnisher when possible.

2. Direct dispute with the furnisher
   - Best when the lender, servicer, or collector is the source of the bad data.
   - Useful when bureau disputes come back verified but the reporting still looks wrong.

3. Method of verification follow-up
   - Best after a bureau verifies an item and the result still does not make sense.
   - Helps the user ask how the bureau verified the account.

4. Statement of dispute
   - Best when a dispute is unresolved and the user wants future reports to include a brief explanation.
   - This is not a deletion tool, but it is a rights-based follow-up step many consumers do not know about.

5. Identity theft block + fraud alert path
   - Best when the account, inquiry, or address is not the user’s and identity theft is involved.
   - Stronger than a generic dispute when the user has an identity theft report.

6. Reinsertion / reappearance review
   - Best when an item was deleted and later comes back.
   - Users should review whether reinsertion notice requirements were met.

7. Personal information / mixed file correction
   - Best when names, addresses, SSN fragments, or other people’s accounts appear on the report.
   - Often overlooked, but can matter a lot when files are mixed.

8. Obsolescence / outdated reporting review
   - Best when negative information may be past normal reporting periods.
   - Especially useful for old collections, charge-offs, judgments, and bankruptcies.

## Workflow support added in this pass

- Expanded the backend dispute-letter workflow type system so automated letters can now support:
  - `Direct Furnisher Dispute`
  - `Method Of Verification`
  - `Statement Of Dispute`
  - `Identity Theft Block`
  - `Mixed File`
  - `Outdated Information`
  - `Personal Information Correction`
- Expanded extraction guidance so automated credit-report analysis can route items into a better dispute method instead of overusing only generic letter types.

## Methods VestBlock should not oversell

- 609 letters as “magic” deletion tools
- Pay-for-delete as a guaranteed outcome
- Goodwill letters as a legal right
- Any method that claims accurate negative data can always be removed
- Any method that asks the user to submit false, incomplete, or misleading facts

## Product positioning rule

VestBlock should frame credit repair around:

- report accuracy
- documentation
- timing
- letter drafting for review
- user-controlled action
- workflow tracking

Not around:

- guaranteed deletions
- guaranteed score jumps
- “secret loopholes”
- legal advice

## Official source backbone used for this audit

- CFPB dispute guidance
- CFPB sample dispute letters
- CFPB direct furnisher dispute guidance
- CFPB unresolved dispute rights guidance
- CFPB reporting-time guidance
- FTC fraud alert and credit freeze guidance
- FCRA identity theft block and reinsertion statutes
