# Lead Scoring And Offer Matching

Use this skill when adjusting VestBlock's lead-score logic or offer routing.

## Score factors

- urgency
- business age
- funding need
- website weakness
- automation gap
- Spanish-language fit
- real-estate distress
- contract opportunity fit
- contactability
- expected value

## Output requirements

Every scored lead should have:

- `lead_score`
- `best_offer`
- `urgency_level`
- `contactability_level`
- `language_segment`
- `outreach_angle`
- `estimated_value_label`

## Offer mapping priorities

- growth/funding need -> `Business Funding`
- credit-building need -> `Business Credit Builder`
- missed-call / automation weakness -> `AI Receptionist Launch`
- booking weakness -> `AI Appointment Booking System`
- weak website -> `Website Upgrade Sprint`
- Spanish-language support need -> `Spanish Funding Assistance`
- public-opportunity fit -> `Gov Contract Readiness`
- new entity setup need -> `Business Setup / Compliance Help`
- seller/distress -> `Real Estate Seller Lead`
