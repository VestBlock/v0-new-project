"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { FileText, Copy, CheckCircle2, FileDown, Printer, AlertTriangle, Info } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { format } from "date-fns"

interface LetterTypeInfo {
  value: string
  label: string
  definition: string
  bestUse: string
}

const letterTypes: LetterTypeInfo[] = [
  {
    value: "609",
    label: "609 Dispute Letter (Request for Validation)",
    definition:
      "A letter sent to credit bureaus under Section 609 of the Fair Credit Reporting Act (FCRA) to request information about how an item on your credit report was verified and to see the source of the information.",
    bestUse:
      "When you want to challenge an item on your credit report and see the evidence the credit bureau has on file. It's often a first step in disputing inaccuracies, especially if you're unsure about the item's origin or validity.",
  },
  {
    value: "debt_validation",
    label: "Debt Validation Letter (to Collector)",
    definition:
      "A letter sent to a debt collector, exercising your rights under the Fair Debt Collection Practices Act (FDCPA), to request that they prove you owe the debt they are trying to collect.",
    bestUse:
      "When a debt collector contacts you about a debt, especially if you don't recognize it, believe the amount is wrong, or want to confirm their legal right to collect. Must be sent within 30 days of their initial contact.",
  },
  {
    value: "goodwill",
    label: "Goodwill Letter (Request for Late Payment Removal)",
    definition:
      "A polite request sent to an original creditor asking them to remove a legitimate negative mark (like a late payment) from your credit report as a gesture of goodwill.",
    bestUse:
      "When you have an otherwise good payment history with a creditor but had an isolated late payment due to a specific circumstance. Best used when the account is now current or paid off.",
  },
  {
    value: "pay_for_delete",
    label: "Pay-for-Delete Letter",
    definition:
      "An offer made to a collection agency to pay a certain amount (often less than the full balance) in exchange for their agreement to completely remove the collection account from your credit report.",
    bestUse:
      "When you have a collection account you're willing to pay, but want to ensure it's deleted from your credit report rather than just marked as 'paid collection.' Success is not guaranteed as not all collectors agree to this.",
  },
  {
    value: "cease_and_desist",
    label: "Cease and Desist Communication Letter",
    definition:
      "A formal letter sent to a debt collector instructing them to stop contacting you about a debt, as per your rights under the FDCPA.",
    bestUse:
      "When you want a debt collector to stop all communication with you. They can still sue you or report to credit bureaus (if the debt is valid and within SOL), but they can't call or write you, except to inform you of specific actions like a lawsuit.",
  },
  {
    value: "credit_card_dispute",
    label: "Credit Card Billing Error/Dispute",
    definition:
      "A letter sent to your credit card issuer to dispute a charge on your statement that you believe is incorrect, unauthorized, or for goods/services not received or not as described.",
    bestUse:
      "For errors like incorrect charge amounts, duplicate charges, charges for items you returned or never received, or unauthorized transactions on your credit card. Must be sent within 60 days of the statement date with the error.",
  },
  {
    value: "identity_theft",
    label: "Identity Theft Dispute (Fraudulent Accounts)",
    definition:
      "A letter sent to credit bureaus and creditors to report accounts or inquiries that were opened or made fraudulently in your name as a result of identity theft.",
    bestUse:
      "When you discover unauthorized accounts, charges, or inquiries on your credit report due to identity theft. Usually accompanied by an FTC Identity Theft Report and a police report.",
  },
  {
    value: "personal_info_dispute",
    label: "Inaccurate Personal Information Dispute",
    definition:
      "A letter sent to credit bureaus to correct errors in your personal identification information on your credit report, such as misspelled names, wrong addresses, incorrect birth dates, or mixed SSNs.",
    bestUse:
      "When your credit report shows incorrect personal details. This is important because mixed or incorrect personal data can lead to other people's information appearing on your report.",
  },
  {
    value: "medical_hipaa_dispute",
    label: "Medical Bill Dispute / HIPAA Violation",
    definition:
      "A letter to dispute a medical debt, often questioning its validity, the amount, or if your protected health information (PHI) was improperly disclosed to a collector in violation of HIPAA.",
    bestUse:
      "When you receive a medical bill you don't recognize, believe is incorrect, or if a collection agency has your medical debt details without your proper authorization. Can also be used to request validation and HIPAA compliance.",
  },
  {
    value: "student_loan_dispute",
    label: "Student Loan Dispute",
    definition:
      "A letter to dispute inaccuracies related to a student loan, such as incorrect balance, payment status, loan servicer errors, or issues with deferment/forbearance.",
    bestUse:
      "When your credit report or loan servicer statements show incorrect information about your student loans. This could be about the loan terms, payment history, or current status.",
  },
  {
    value: "sol_debt_letter",
    label: "Statute of Limitations (SOL) Debt Letter",
    definition:
      "A letter informing a debt collector that the debt they are trying to collect is 'time-barred,' meaning the legal time limit (statute of limitations) for suing you to collect the debt has expired.",
    bestUse:
      "When a collector is pursuing an old debt that you believe is past the statute of limitations in your state. This letter asserts that they cannot legally sue you for it.",
  },
  {
    value: "outdated_info_dispute",
    label: "Outdated Information Dispute (Past Reporting Limit)",
    definition:
      "A letter to credit bureaus requesting the removal of negative information that is older than the FCRA-allowed reporting period (typically 7 years for most items, 10 for some bankruptcies).",
    bestUse:
      "When you find old negative items on your credit report (like charge-offs, collections, late payments) that should have been removed because they've passed their legal reporting timeframe.",
  },
  {
    value: "inquiry_dispute",
    label: "Unauthorized Credit Inquiry Dispute",
    definition:
      "A letter sent to credit bureaus to dispute a hard inquiry on your credit report that you did not authorize or that doesn't correspond to any application you made for credit.",
    bestUse:
      "When you see a hard inquiry on your report from a company you didn't apply for credit with. Unauthorized hard inquiries can slightly lower your credit score.",
  },
  {
    value: "public_record_dispute",
    label: "Public Record Dispute (e.g., Bankruptcy, Lien)",
    definition:
      "A letter to credit bureaus to dispute inaccurate or outdated public record information, such as bankruptcies, tax liens, or civil judgments, that are incorrectly reported or should no longer be listed.",
    bestUse:
      "When a public record on your credit report is incorrect (e.g., wrong case number, belongs to someone else, shows an incorrect status like an unpaid lien that was actually released, or is outdated).",
  },
  {
    value: "duplicate_account_dispute",
    label: "Duplicate Account Dispute",
    definition:
      "A letter to credit bureaus to report that the same debt or account is listed multiple times on your credit report, which can inaccurately inflate your debt or number of accounts.",
    bestUse:
      "When you notice an account (e.g., a loan, credit card, collection) appearing more than once on your credit report. This can negatively impact your credit profile.",
  },
  {
    value: "mixed_file_dispute",
    label: "Mixed File / Merged File Dispute",
    definition:
      "A letter to credit bureaus when you suspect your credit report contains information belonging to another person, often due to similar names or SSNs, resulting in a 'mixed' or 'merged' file.",
    bestUse:
      "If you see accounts, addresses, names, or other information on your credit report that are definitely not yours. This is a serious issue that needs prompt correction.",
  },
  {
    value: "side_hustle_debt",
    label: "Side Hustle Business Debt (Incorrectly on Personal)",
    definition:
      "A letter to dispute a business-related debt that is incorrectly appearing on your personal credit report. Business debts should generally be separate from personal credit unless personally guaranteed.",
    bestUse:
      "When a debt incurred solely for your business (especially if the business is a separate legal entity like an LLC or corporation, or if the account was opened in the business's name/EIN) is showing up on your personal credit history.",
  },
]

const creditBureaus = [
  { value: "equifax", label: "Equifax" },
  { value: "experian", label: "Experian" },
  { value: "transunion", label: "TransUnion" },
  { value: "all", label: "All Three Bureaus (General Dispute)" },
  { value: "custom", label: "Custom Recipient (e.g., Original Creditor, Collector)" },
]

const LETTER_TEMPLATES = {
  "609": `[DATE]

[RECIPIENT_NAME]
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Formal Request for Validation and Verification of Alleged Account - Account #[ACCOUNT_NUMBER]
Report Number (if available): [REPORT_NUMBER]

To Whom It May Concern:

I am writing to dispute the reporting of the above-referenced account, which appears on my credit report. I am exercising my rights under the Fair Credit Reporting Act (FCRA), specifically Section 609 (15 U.S.C. § 1681g).

I request that you provide me with complete validation and verification of this alleged debt. This includes, but is not limited to:
1.  A copy of the original signed contract or application bearing my signature that establishes this account.
2.  A complete accounting of the alleged debt, including the original amount, any interest, fees, or other charges.
3.  Proof that you are licensed to collect debts in my state (if applicable).
4.  The name and address of the original creditor if different from your company.
5.  Verification that the statute of limitations for reporting or collecting this debt has not expired.

Please provide this documentation within 30 days of receipt of this letter. If you are unable to validate this debt as requested, I demand that this item be immediately deleted from my credit report. Failure to do so may result in further action on my part.

Please also provide the method of verification as required by FCRA § 611(a)(7).

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]
Date of Birth: [YOUR_DOB]
Social Security Number: [YOUR_SSN_LAST4_OR_FULL_IF_COMFORTABLE]`,

  debt_validation: `[DATE]

[RECIPIENT_NAME] (Debt Collector Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Debt Validation Request - Account #[ACCOUNT_NUMBER] (Your Reference: [COLLECTOR_REFERENCE_NUMBER])

To Whom It May Concern:

I am writing in response to your communication dated [DATE_OF_COLLECTOR_COMMUNICATION] (or describe communication) regarding the alleged debt for account number [ACCOUNT_NUMBER], originally with [ORIGINAL_CREDITOR_NAME_IF_KNOWN].

This letter is a formal request for validation of this debt pursuant to the Fair Debt Collection Practices Act (FDCPA), 15 USC 1692g Sec. 809(b). I dispute the validity of this debt.

Please provide the following:
1.  Proof that your company owns this debt or has been assigned the authority to collect it.
2.  A copy of the original signed agreement with the original creditor that created this debt.
3.  A complete itemization of the debt, including the principal amount, interest accrued, fees, and any payments made.
4.  The name and address of the original creditor.
5.  Verification that the statute of limitations for collecting this debt has not expired in my state.

Until this debt is validated, I demand that you cease all collection activities, including reporting this item to any credit reporting agencies. If this item is already on my credit report, please mark it as "disputed by consumer."

If you cannot provide this validation within 30 days, you must cease all collection efforts and remove this item from my credit report.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  goodwill: `[DATE]

[RECIPIENT_NAME] (Creditor Name, Customer Service or Executive Office)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Goodwill Adjustment Request - Account #[ACCOUNT_NUMBER]

Dear [MR_MS_CONTACT_PERSON_OR_TO_WHOM_IT_MAY_CONCERN],

I am writing to respectfully request a goodwill adjustment for a late payment reported on my account #[ACCOUNT_NUMBER] on or around [DATE_OF_LATE_PAYMENT].

I have been a customer of [CREDITOR_NAME] for [DURATION_OF_RELATIONSHIP, e.g., X years] and have always strived to maintain a positive payment history. Unfortunately, due to [BRIEFLY_EXPLAIN_REASON_FOR_LATE_PAYMENT_e_g_unexpected_medical_issue_temporary_job_loss_bank_error], a payment was made late. This was an isolated incident and not reflective of my usual commitment to my financial obligations.

Since that time, I have [MENTION_POSITIVE_ACTIONS_e_g_maintained_on_time_payments_paid_off_the_balance]. The negative mark associated with this late payment is impacting my creditworthiness as I am currently [REASON_FOR_NEEDING_GOOD_CREDIT_e_g_seeking_a_mortgage_applying_for_a_new_job].

I understand that the original reporting was accurate based on the terms of our agreement. However, I am kindly asking for your understanding and consideration in removing this late payment notation as a gesture of goodwill. I value my relationship with [CREDITOR_NAME] and hope to continue it for years to come.

Thank you for your time and consideration of this important matter.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,
  pay_for_delete: `[DATE]

[RECIPIENT_NAME] (Collection Agency Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Offer to Settle and Delete - Account #[ACCOUNT_NUMBER] (Original Creditor: [ORIGINAL_CREDITOR_NAME_IF_KNOWN])

Dear [MR_MS_CONTACT_PERSON_OR_TO_WHOM_IT_MAY_CONCERN],

I am writing regarding the alleged debt for account number [ACCOUNT_NUMBER], which your agency is attempting to collect. The reported balance is [REPORTED_BALANCE_AMOUNT].

Without admitting the validity or amount of this debt, I am willing to offer [OFFER_AMOUNT, e.g., $XXX.XX or XX% of the balance] as full and final settlement of this account.

This offer is strictly contingent upon your written agreement to the following terms:
1.  Upon receipt and clearance of my payment of [OFFER_AMOUNT], you will consider this account fully settled and paid.
2.  You will remove any and all references to this account (including any negative listings, charge-offs, or collection remarks) from all credit reporting agencies (Equifax, Experian, TransUnion, and any others) within [e.g., 15-30] days of payment clearance. This means a complete deletion, not merely an update to "paid collection" or "settled."
3.  You will cease all collection activities related to this account.

If you accept this offer, please provide a signed agreement on your company letterhead confirming these terms. Upon receipt of your written confirmation, I will promptly send payment in the form of [PAYMENT_METHOD_e_g_cashiers_check_money_order].

This offer will remain open for [e.g., 15] days from the date of this letter. If I do not receive your written agreement within this timeframe, this offer is withdrawn.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  cease_and_desist: `[DATE]

[RECIPIENT_NAME] (Debt Collector Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Cease and Desist All Communication - Account #[ACCOUNT_NUMBER]

To Whom It May Concern:

Pursuant to my rights under the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692c(c), I am formally requesting that you cease and desist all communications with me, my family, and my employer regarding the alleged debt associated with account number [ACCOUNT_NUMBER].

This notice applies to all forms of communication, including telephone calls, letters, emails, faxes, and any other means of contact.

Under the FDCPA, once you receive this notice, you may only contact me to:
1.  Advise that your collection efforts are being terminated.
2.  Notify me that you may invoke specified remedies which are ordinarily invoked by you or the creditor.
3.  Notify me that you intend to invoke a specified remedy.

Any other communication will be considered a violation of the FDCPA. I will document all further violations and may pursue legal action.

This letter does not constitute an admission of liability for this alleged debt.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  credit_card_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Card Issuer Name, Billing Inquiries Department)
[RECIPIENT_ADDRESS] (Usually found on your billing statement)
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Billing Error Dispute - Account #[ACCOUNT_NUMBER]

Dear Sir/Madam:

I am writing to dispute a charge (or charges) on my credit card account #[ACCOUNT_NUMBER]. My statement dated [STATEMENT_DATE] shows the following error(s):

Transaction Date: [DATE_OF_TRANSACTION]
Merchant Name: [MERCHANT_NAME]
Amount: $[AMOUNT_IN_DISPUTE]
Reason for Dispute: [CLEARLY_EXPLAIN_THE_REASON_FOR_DISPUTE_e_g_unauthorized_charge_goods_not_received_defective_merchandise_incorrect_amount_billed_etc_Provide_as_much_detail_as_possible]

I have already attempted to resolve this issue with the merchant on [DATE_OF_CONTACT_WITH_MERCHANT] by [METHOD_OF_CONTACT] but was unsuccessful (or explain why you couldn't contact the merchant).

I am requesting that you investigate this matter and remove the disputed charge(s) from my account. Please also credit any finance charges or fees that were assessed as a result of this error.

I have enclosed copies of [LIST_SUPPORTING_DOCUMENTS_e_g_receipts_correspondence_with_merchant_photos_etc] to support my claim.

Please investigate this matter and inform me of your findings within the timeframe specified by the Fair Credit Billing Act.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  identity_theft: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name or Creditor/Collector Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Identity Theft Dispute - Fraudulent Account #[ACCOUNT_NUMBER_IF_KNOWN]
My Full Name: [YOUR_FULL_LEGAL_NAME]
My Date of Birth: [YOUR_DOB]
My Social Security Number: [YOUR_SSN]

To Whom It May Concern:

I am a victim of identity theft. I am writing to dispute the fraudulent account(s) listed below, which I did not open or authorize:

Creditor Name: [CREDITOR_NAME_OF_FRAUDULENT_ACCOUNT]
Account Number: [ACCOUNT_NUMBER_OF_FRAUDULENT_ACCOUNT]
Date Opened (if known): [DATE_OPENED]
Amount (if known): $[AMOUNT]
Reason for Dispute: This account was opened fraudulently without my knowledge or consent as a result of identity theft.

I have enclosed the following documents to support my claim:
1.  A copy of my FTC Identity Theft Report (Report Number: [FTC_REPORT_NUMBER]).
2.  A copy of the police report filed with [POLICE_DEPARTMENT_NAME] (Report Number: [POLICE_REPORT_NUMBER]).
3.  A copy of my driver's license or other government-issued ID for identification.
4.  Proof of my address (e.g., utility bill).

Under the Fair Credit Reporting Act (FCRA), I request that you:
1.  Immediately block this fraudulent information from appearing on my credit report.
2.  Investigate this claim and permanently remove these fraudulent accounts and any associated inquiries from my credit file.
3.  Provide me with the results of your investigation in writing.

Please send all correspondence to my address listed above.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  personal_info_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Inaccurate Personal Information
My Full Name: [YOUR_FULL_LEGAL_NAME]
My Date of Birth: [YOUR_DOB]
My Social Security Number: [YOUR_SSN]

To Whom It May Concern:

I am writing to dispute inaccurate personal identification information appearing on my credit report. I have recently reviewed my credit report from your agency, dated [DATE_OF_REPORT_REVIEWED] (or Report Number: [REPORT_NUMBER]), and found the following inaccuracies:

Incorrect Information Currently Listed:
[LIST_EACH_PIECE_OF_INCORRECT_INFO_e_g_Name_John_Doe_Address_123_Wrong_St_SSN_XXX_XX_WRNG]

Correct Information:
[LIST_CORRESPONDING_CORRECT_INFO_e_g_Correct_Name_Jon_Doe_Correct_Address_456_Right_Ave_Correct_SSN_XXX_XX_CRCT]

I have enclosed copies of the following documents to verify my correct personal information:
1.  A copy of my driver's license (or other government-issued ID).
2.  A copy of my Social Security card (if disputing SSN).
3.  A recent utility bill or bank statement showing my correct address.

Under the Fair Credit Reporting Act (FCRA), I request that you investigate this matter and correct or delete the inaccurate personal information from my credit file immediately. Please provide me with an updated copy of my credit report once the corrections have been made.

Thank you for your prompt attention to this matter.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  medical_hipaa_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Bureau or Collection Agency Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Medical Debt & HIPAA Violation - Account #[ACCOUNT_NUMBER]
Original Medical Provider: [ORIGINAL_MEDICAL_PROVIDER_IF_KNOWN]
Date of Service (approximate): [DATE_OF_SERVICE_IF_KNOWN]

To Whom It May Concern:

I am writing to dispute the validity of the alleged medical debt associated with account number [ACCOUNT_NUMBER], which is appearing on my credit report or for which I have received collection notices.

I request full validation of this debt as required by the Fair Debt Collection Practices Act (FDCPA) and the Fair Credit Reporting Act (FCRA). This validation must include:
1.  Proof that I authorized the services for which this debt is claimed.
2.  An itemized statement from the original medical provider detailing the services rendered and charges.
3.  Proof that you are authorized to collect this debt.
4.  Evidence that my protected health information (PHI) was disclosed to you in compliance with the Health Insurance Portability and Accountability Act (HIPAA). Specifically, I request a copy of my signed authorization for the release of my PHI to your agency for collection purposes.

Without a valid HIPAA authorization, the disclosure of my PHI to you by the medical provider may constitute a violation of federal law. Reporting this unverified and potentially unlawfully disclosed information to credit bureaus is also a violation of the FCRA.

I demand that you cease all collection activities and remove this item from my credit report until full validation, including HIPAA compliance, is provided. If you cannot provide this validation within 30 days, this item must be permanently deleted.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]
Date of Birth: [YOUR_DOB]`,

  student_loan_dispute: `[DATE]

[RECIPIENT_NAME] (Student Loan Servicer, Collection Agency, or Credit Bureau)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Student Loan Information - Account #[ACCOUNT_NUMBER]
Loan Type (if known): [e.g., Federal Direct Loan, Private Loan]
Original Lender (if known): [ORIGINAL_LENDER]

To Whom It May Concern:

I am writing to dispute information related to my student loan, account number [ACCOUNT_NUMBER], as it appears on my credit report or in communications I have received from you.

The specific information I am disputing is:
[CLEARLY_STATE_THE_INACCURACY_e_g_Incorrect_balance_of_X_Incorrect_payment_status_reported_as_late_Loan_is_in_forbearance_deferment_but_reported_otherwise_This_loan_was_discharged_in_bankruptcy_etc]

This information is inaccurate because:
[EXPLAIN_WHY_IT_IS_INACCURATE_Provide_details_and_dates_if_possible]

I request that you investigate this matter and correct the inaccurate information. Please provide documentation supporting the information you are reporting. This includes, but is not limited to:
1.  A complete loan payment history.
2.  A copy of the original promissory note.
3.  Documentation related to any forbearance, deferment, or discharge status.
4.  Verification of the current balance and interest calculations.

If this dispute is with a credit bureau, please forward this dispute to the information furnisher.

I have enclosed copies of [LIST_SUPPORTING_DOCUMENTS_e_g_payment_records_correspondence_loan_statements_discharge_papers] to support my claim.

Please correct my records and credit report and provide me with written confirmation of the actions taken.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]
Date of Birth: [YOUR_DOB]
Social Security Number (last 4 digits): XXX-XX-[YOUR_SSN_LAST4]`,

  sol_debt_letter: `[DATE]

[RECIPIENT_NAME] (Debt Collector Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Time-Barred Debt Notification - Account #[ACCOUNT_NUMBER]
Original Creditor: [ORIGINAL_CREDITOR_NAME_IF_KNOWN]
Date of Last Payment/Activity (approximate): [DATE_OF_LAST_PAYMENT_OR_ACTIVITY_IF_KNOWN]

To Whom It May Concern:

I am writing in response to your attempts to collect on the above-referenced account. I believe this alleged debt is beyond the statute of limitations applicable in my state of [YOUR_STATE_OF_RESIDENCE].

The statute of limitations for [TYPE_OF_DEBT_e_g_written_contract_credit_card_debt] in [YOUR_STATE_OF_RESIDENCE] is [NUMBER] years. Based on my records, the last payment or activity on this account occurred on or around [DATE_OF_LAST_PAYMENT_OR_ACTIVITY_IF_KNOWN], which is more than [NUMBER] years ago.

Therefore, you cannot legally sue me to collect this debt. Any attempt to do so may result in legal action against your company for violating the Fair Debt Collection Practices Act (FDCPA). Furthermore, reporting this time-barred debt to credit reporting agencies without indicating it is time-barred, or in a way that re-ages it, may also violate the FDCPA and FCRA.

I demand that you cease all collection efforts on this time-barred debt immediately. Please also confirm in writing that you will not pursue any legal action and that this account will not be reported to credit bureaus, or if already reported, will be removed or correctly noted as time-barred.

This letter is not an acknowledgment of this debt, nor is it a promise to pay.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  outdated_info_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Outdated Information - Account #[ACCOUNT_NUMBER]
Creditor Name: [CREDITOR_NAME]
Date of First Delinquency (approximate): [DATE_OF_FIRST_DELINQUENCY_IF_KNOWN]

To Whom It May Concern:

I am writing to dispute an item on my credit report from your agency, dated [DATE_OF_REPORT_REVIEWED] (or Report Number: [REPORT_NUMBER]), that I believe is outdated and should no longer be reported.

The item in question is:
Account Name: [CREDITOR_NAME]
Account Number: [ACCOUNT_NUMBER]
Type of Item: [e.g., Collection, Charge-off, Late Payment]

Under the Fair Credit Reporting Act (FCRA), most negative information can only be reported for seven (7) years. For some items like bankruptcies, the period is longer. The date of first delinquency for this account was on or around [DATE_OF_FIRST_DELINQUENCY_IF_KNOWN]. This means the reporting period for this item has expired.

I request that you investigate this matter and remove this outdated information from my credit file immediately. Please provide me with an updated copy of my credit report once the item has been deleted.

Thank you for your prompt attention to this matter.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]
Date of Birth: [YOUR_DOB]
Social Security Number: [YOUR_SSN_LAST4_OR_FULL_IF_COMFORTABLE]`,

  inquiry_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Unauthorized Credit Inquiry
My Full Name: [YOUR_FULL_LEGAL_NAME]
My Date of Birth: [YOUR_DOB]
My Social Security Number: [YOUR_SSN]

To Whom It May Concern:

I have reviewed my credit report from your agency, dated [DATE_OF_REPORT_REVIEWED] (or Report Number: [REPORT_NUMBER]), and found the following credit inquiry that I did not authorize:

Creditor Name: [NAME_OF_COMPANY_THAT_MADE_INQUIRY]
Date of Inquiry: [DATE_OF_INQUIRY]
Type of Inquiry (if known): [Hard/Soft - usually disputing Hard]

I did not initiate this inquiry, nor did I provide [NAME_OF_COMPANY_THAT_MADE_INQUIRY] with permissible purpose to access my credit report on this date. This unauthorized inquiry is negatively impacting my credit score.

Under the Fair Credit Reporting Act (FCRA), inquiries may only be made with a permissible purpose. I request that you investigate this unauthorized inquiry and remove it from my credit file immediately.

Please provide me with written confirmation of its removal and an updated copy of my credit report.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  public_record_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Inaccurate Public Record Information
My Full Name: [YOUR_FULL_LEGAL_NAME]
My Date of Birth: [YOUR_DOB]
My Social Security Number: [YOUR_SSN]

To Whom It May Concern:

I am writing to dispute inaccurate public record information appearing on my credit report from your agency, dated [DATE_OF_REPORT_REVIEWED] (or Report Number: [REPORT_NUMBER]).

The public record in question is:
Type of Public Record: [e.g., Bankruptcy, Tax Lien, Civil Judgment]
Court or Agency Name (if known): [COURT_OR_AGENCY_NAME]
Case or Docket Number (if known): [CASE_OR_DOCKET_NUMBER]
Date Filed (if known): [DATE_FILED]

This information is inaccurate because:
[CLEARLY_EXPLAIN_WHY_IT_IS_INACCURATE_e_g_This_bankruptcy_was_discharged_on_X_date_and_should_be_updated_This_tax_lien_was_paid_and_released_on_X_date_This_judgment_does_not_belong_to_me_it_belongs_to_someone_with_a_similar_name_This_record_is_outdated_etc]

I have enclosed copies of [LIST_SUPPORTING_DOCUMENTS_e_g_court_records_release_of_lien_discharge_papers_proof_of_payment_identification_documents_if_misidentification] to support my claim.

Under the Fair Credit Reporting Act (FCRA), I request that you investigate this matter and correct or delete this inaccurate public record information from my credit file immediately. Please provide me with an updated copy of my credit report once the corrections have been made.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  duplicate_account_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Duplicate Account Listing
My Full Name: [YOUR_FULL_LEGAL_NAME]
My Date of Birth: [YOUR_DOB]
My Social Security Number: [YOUR_SSN_LAST4_OR_FULL_IF_COMFORTABLE]

To Whom It May Concern:

Upon reviewing my credit report from your agency, dated [DATE_OF_REPORT_REVIEWED] (or Report Number: [REPORT_NUMBER]), I have identified what appears to be a duplicate listing for the same account.

The account in question is with [CREDITOR_NAME]. It is listed as follows:
Duplicate Listing 1 - Account Number: [ACCOUNT_NUMBER_1] (Details: [BRIEF_DETAILS_LIKE_BALANCE_OPEN_DATE_1])
Duplicate Listing 2 - Account Number: [ACCOUNT_NUMBER_2] (Details: [BRIEF_DETAILS_LIKE_BALANCE_OPEN_DATE_2])
(If more than two, list all of them)

These listings appear to refer to the same obligation. Reporting the same account multiple times is inaccurate and can negatively affect my credit score by misrepresenting my total debt or number of accounts.

I request that you investigate this matter and remove the duplicate listing(s), ensuring only one accurate representation of this account remains on my credit file. Please consolidate the information into the correct, single entry.

Please provide me with written confirmation of the correction and an updated copy of my credit report.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  mixed_file_dispute: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Mixed File / Merged File Information
My Full Name: [YOUR_FULL_LEGAL_NAME]
My Date of Birth: [YOUR_DOB]
My Social Security Number: [YOUR_SSN]
My Current Address: [YOUR_CURRENT_ADDRESS]
My Previous Addresses (last 5 years): [LIST_PREVIOUS_ADDRESSES]

To Whom It May Concern:

I have reviewed my credit report from your agency, dated [DATE_OF_REPORT_REVIEWED] (or Report Number: [REPORT_NUMBER]), and I believe it contains information belonging to another individual. This indicates a mixed or merged credit file.

The following information does NOT belong to me:
1.  Account(s):
    *   Creditor: [CREDITOR_NAME_OF_INCORRECT_ACCOUNT], Account Number: [ACCOUNT_NUMBER_OF_INCORRECT_ACCOUNT]
    *   (List all incorrect accounts with as much detail as possible)
2.  Personal Information:
    *   Name(s): [INCORRECT_NAMES_LISTED]
    *   Address(es): [INCORRECT_ADDRESSES_LISTED]
    *   SSN(s): [INCORRECT_SSNS_LISTED_IF_VISIBLE]
    *   Employer(s): [INCORRECT_EMPLOYERS_LISTED]
3.  Public Record(s):
    *   [DETAILS_OF_INCORRECT_PUBLIC_RECORDS]
4.  Inquir(ies):
    *   [DETAILS_OF_INCORRECT_INQUIRIES]

I have enclosed copies of the following documents to verify my identity and correct information:
1.  A copy of my driver's license or other government-issued ID.
2.  A copy of my Social Security card.
3.  Proof of my current and previous addresses (e.g., utility bills, rental agreements).

I request a thorough investigation into this matter. Please unmerge my file from any other consumer's file and remove all information that does not pertain to me. This is critical as it severely impacts my creditworthiness.

Please provide me with written confirmation of the corrections made and a completely accurate copy of my credit report.

Sincerely,

[YOUR_NAME]
[YOUR_ADDRESS]
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,

  side_hustle_debt: `[DATE]

[RECIPIENT_NAME] (Credit Bureau Name or Creditor/Collector Name)
[RECIPIENT_ADDRESS]
[RECIPIENT_CITY], [RECIPIENT_STATE] [RECIPIENT_ZIP]

Re: Dispute of Business Debt Incorrectly Reported on Personal Credit File - Account #[ACCOUNT_NUMBER]
Business Name: [YOUR_BUSINESS_NAME]
Business EIN (if applicable): [YOUR_BUSINESS_EIN]

To Whom It May Concern:

I am writing to dispute the reporting of account number [ACCOUNT_NUMBER] with [CREDITOR_NAME] on my personal credit report. This account was established for and used exclusively by my business, [YOUR_BUSINESS_NAME], and should not be reflected on my personal credit file.

My business, [YOUR_BUSINESS_NAME], is a [BUSINESS_STRUCTURE_e_g_Sole_Proprietorship_LLC_etc]. The aforementioned account was opened under the business's name and/or EIN for business purposes only. Reporting this business obligation on my personal credit report is inaccurate and misrepresents my personal credit history and liabilities.

I request that you investigate this matter and take the following actions:
1.  If reporting to credit bureaus: Remove this account entirely from my personal credit report.
2.  If you are the creditor/collector: Correct your records to reflect this as a business obligation and cease reporting it to personal credit bureaus.

I have enclosed documentation to support my claim that this is a business debt, such as:
[LIST_SUPPORTING_DOCUMENTS_e_g_Business_bank_statements_showing_payments_Copy_of_the_original_agreement_if_in_business_name_Business_registration_documents_Invoices_or_receipts_showing_business_use]

Please provide me with written confirmation of the actions taken to correct this reporting error.

Sincerely,

[YOUR_NAME] (Personal Name)
[YOUR_ADDRESS] (Personal Address)
[YOUR_CITY], [YOUR_STATE] [YOUR_ZIP]
[YOUR_PHONE]
[YOUR_EMAIL]`,
  // ... other templates from previous version ...
}

interface DisputeLetterGeneratorProps {
  initialCreditor?: string
  initialDetails?: string
  recommendedStrategy?: string
  initialAccountNumber?: string
}

export function DisputeLetterGenerator({
  initialCreditor = "",
  initialDetails = "",
  recommendedStrategy = "",
  initialAccountNumber = "",
}: DisputeLetterGeneratorProps) {
  const [letterType, setLetterType] = useState("609")
  const [selectedLetterDetails, setSelectedLetterDetails] = useState<LetterTypeInfo | null>(null)
  const [creditorName, setCreditorName] = useState(initialCreditor)
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber)
  const [customDetails, setCustomDetails] = useState(initialDetails)
  const [isGenerating, setIsGenerating] = useState(false)
  const [letterContent, setLetterContent] = useState("")
  const [copied, setCopied] = useState(false)
  const [bureau, setBureau] = useState("equifax")
  const [customRecipient, setCustomRecipient] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  })
  const [userInfo, setUserInfo] = useState({
    name: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    phone_number: "",
    email: "",
    dob: "",
    ssn: "",
  })
  const { toast } = useToast()
  const { user } = useAuth()
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (initialCreditor) setCreditorName(initialCreditor)
  }, [initialCreditor])
  useEffect(() => {
    if (initialDetails) setCustomDetails(initialDetails)
  }, [initialDetails])
  useEffect(() => {
    if (initialAccountNumber) setAccountNumber(initialAccountNumber)
  }, [initialAccountNumber])

  useEffect(() => {
    if (recommendedStrategy) {
      const foundType = letterTypes.find((lt) => lt.value === recommendedStrategy)
      if (foundType) {
        setLetterType(recommendedStrategy)
      } else {
        const strategyLower = recommendedStrategy.toLowerCase()
        if (strategyLower.includes("609")) setLetterType("609")
        else if (strategyLower.includes("validation")) setLetterType("debt_validation")
        // ... (other intelligent fallbacks)
      }
    }
  }, [recommendedStrategy])

  useEffect(() => {
    const details = letterTypes.find((lt) => lt.value === letterType)
    setSelectedLetterDetails(details || null)
  }, [letterType])

  useEffect(() => {
    const loadUserInfo = async () => {
      if (user) {
        const { data, error } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).single()
        if (data && !error) {
          setUserInfo((prev) => ({
            ...prev,
            name: data.full_name || "",
            address_street: data.address_street || "",
            address_city: data.address_city || "",
            address_state: data.address_state || "",
            address_zip: data.address_zip || "",
            phone_number: data.phone_number || "",
            email: user.email || "",
            dob: data.date_of_birth || "",
            ssn: data.ssn || "",
          }))
        }
      }
    }
    loadUserInfo()
  }, [user, supabase])

  const BUREAU_ADDRESSES = {
    equifax: {
      name: "Equifax Information Services LLC",
      address: "P.O. Box 740256",
      city: "Atlanta",
      state: "GA",
      zip: "30374",
    },
    experian: { name: "Experian", address: "P.O. Box 4500", city: "Allen", state: "TX", zip: "75013" },
    transunion: {
      name: "TransUnion Consumer Solutions",
      address: "P.O. Box 2000",
      city: "Chester",
      state: "PA",
      zip: "19016",
    },
  }

  const generateLetter = async () => {
    // ... (generateLetter logic remains largely the same)
    if (!letterType) {
      toast({ title: "Missing Letter Type", description: "Please select a letter type.", variant: "destructive" })
      return
    }
    // ... (rest of validation and generation logic)
    setIsGenerating(true)
    setLetterContent("")

    try {
      let content = LETTER_TEMPLATES[letterType as keyof typeof LETTER_TEMPLATES] || "Error: Letter template not found."
      if (content.startsWith("Error:")) {
        toast({ title: "Template Error", description: content, variant: "destructive" })
        setIsGenerating(false)
        return
      }

      let recipientInfo = { name: "", address: "", city: "", state: "", zip: "" }
      if (bureau === "custom") recipientInfo = customRecipient
      else if (bureau === "all")
        recipientInfo = {
          name: "Equifax, Experian, and TransUnion",
          address: "See individual bureau addresses",
          city: "",
          state: "",
          zip: "",
        }
      else recipientInfo = BUREAU_ADDRESSES[bureau as keyof typeof BUREAU_ADDRESSES]

      const today = format(new Date(), "MMMM d, yyyy")
      const ssnLast4 = userInfo.ssn ? `XXX-XX-${userInfo.ssn.slice(-4)}` : "[Last 4 of SSN]"

      content = content
        .replace(/\[DATE\]/g, today)
        .replace(/\[RECIPIENT_NAME\]/g, recipientInfo.name || "[Recipient Name]")
        .replace(/\[RECIPIENT_ADDRESS\]/g, recipientInfo.address || "[Recipient Address]")
        .replace(/\[RECIPIENT_CITY\]/g, recipientInfo.city || "[Recipient City]")
        .replace(/\[RECIPIENT_STATE\]/g, recipientInfo.state || "[Recipient State]")
        .replace(/\[RECIPIENT_ZIP\]/g, recipientInfo.zip || "[Recipient ZIP]")
        .replace(/\[CREDITOR_NAME\]/g, creditorName || "[Creditor Name]")
        .replace(/\[ACCOUNT_NUMBER\]/g, accountNumber || "[Account Number]")
        .replace(/\[YOUR_NAME\]/g, userInfo.name || "[Your Full Name]")
        .replace(/\[YOUR_FULL_LEGAL_NAME\]/g, userInfo.name || "[Your Full Legal Name]")
        .replace(/\[YOUR_ADDRESS\]/g, `${userInfo.address_street || "[Your Street Address]"}`)
        .replace(/\[YOUR_CITY\]/g, userInfo.address_city || "[Your City]")
        .replace(/\[YOUR_STATE\]/g, userInfo.address_state || "[Your State]")
        .replace(/\[YOUR_ZIP\]/g, userInfo.address_zip || "[Your ZIP]")
        .replace(/\[YOUR_PHONE\]/g, userInfo.phone_number || "[Your Phone Number]")
        .replace(/\[YOUR_EMAIL\]/g, userInfo.email || "[Your Email Address]")
        .replace(/\[YOUR_DOB\]/g, userInfo.dob ? format(new Date(userInfo.dob), "MM/dd/yyyy") : "[Your Date of Birth]")
        .replace(/\[YOUR_SSN\]/g, userInfo.ssn || "[Your Social Security Number]")
        .replace(/\[YOUR_SSN_LAST4_OR_FULL_IF_COMFORTABLE\]/g, userInfo.ssn || "[Your SSN or Last 4 Digits]")
        .replace(/\[YOUR_SSN_LAST4\]/g, ssnLast4)
        // Add other specific placeholders as needed by new templates
        .replace(/\[REPORT_NUMBER\]/g, "[Report Number if available]")
        .replace(/\[COLLECTOR_REFERENCE_NUMBER\]/g, "[Collector's Reference Number if any]")
        .replace(/\[DATE_OF_COLLECTOR_COMMUNICATION\]/g, "[Date of Collector's Communication]")
        .replace(/\[ORIGINAL_CREDITOR_NAME_IF_KNOWN\]/g, creditorName || "[Original Creditor Name]")
        .replace(/\[DURATION_OF_RELATIONSHIP.e.g..X.years\]/g, "[Duration of Relationship, e.g., X years]")
        .replace(/\[DATE_OF_LATE_PAYMENT\]/g, "[Date of Late Payment]")
        .replace(
          /\[BRIEFLY_EXPLAIN_REASON_FOR_LATE_PAYMENT_e_g_unexpected_medical_issue_temporary_job_loss_bank_error\]/g,
          customDetails || "[Reason for Late Payment]",
        )
        .replace(
          /\[MENTION_POSITIVE_ACTIONS_e_g_maintained_on_time_payments_paid_off_the_balance\]/g,
          "[Positive Actions Taken Since]",
        )
        .replace(
          /\[REASON_FOR_NEEDING_GOOD_CREDIT_e_g_seeking_a_mortgage_applying_for_a_new_job\]/g,
          "[Reason for Needing Good Credit]",
        )
        .replace(/\[REPORTED_BALANCE_AMOUNT\]/g, "[Reported Balance Amount]")
        .replace(/\[OFFER_AMOUNT.e.g..$XXX.XX.or.XX%.of.the.balance\]/g, "[Offer Amount]")
        .replace(/\[PAYMENT_METHOD_e_g_cashiers_check_money_order\]/g, "[Proposed Payment Method]")
        .replace(/\[STATEMENT_DATE\]/g, "[Statement Date]")
        .replace(/\[DATE_OF_TRANSACTION\]/g, "[Date of Transaction]")
        .replace(/\[MERCHANT_NAME\]/g, "[Merchant Name]")
        .replace(/\[AMOUNT_IN_DISPUTE\]/g, "[Amount in Dispute]")
        .replace(
          /\[CLEARLY_EXPLAIN_THE_REASON_FOR_DISPUTE_e_g_unauthorized_charge_goods_not_received_defective_merchandise_incorrect_amount_billed_etc_Provide_as_much_detail_as_possible\]/g,
          customDetails || "[Detailed Reason for Dispute]",
        )
        .replace(/\[DATE_OF_CONTACT_WITH_MERCHANT\]/g, "[Date of Contact with Merchant]")
        .replace(/\[METHOD_OF_CONTACT\]/g, "[Method of Contact with Merchant]")
        .replace(
          /\[LIST_SUPPORTING_DOCUMENTS_e_g_receipts_correspondence_with_merchant_photos_etc\]/g,
          "[List of Supporting Documents Enclosed]",
        )
        .replace(/\[FTC_REPORT_NUMBER\]/g, "[FTC Identity Theft Report Number]")
        .replace(/\[POLICE_DEPARTMENT_NAME\]/g, "[Police Department Name]")
        .replace(/\[POLICE_REPORT_NUMBER\]/g, "[Police Report Number]")
        .replace(/\[DATE_OF_REPORT_REVIEWED\]/g, "[Date Credit Report Was Reviewed]")
        .replace(
          /\[LIST_EACH_PIECE_OF_INCORRECT_INFO_e_g_Name_John_Doe_Address_123_Wrong_St_SSN_XXX_XX_WRNG\]/g,
          "[List of Incorrect Information]",
        )
        .replace(
          /\[LIST_CORRESPONDING_CORRECT_INFO_e_g_Correct_Name_Jon_Doe_Correct_Address_456_Right_Ave_Correct_SSN_XXX_XX_CRCT\]/g,
          "[List of Correct Information]",
        )
        .replace(/\[ORIGINAL_MEDICAL_PROVIDER_IF_KNOWN\]/g, "[Original Medical Provider Name]")
        .replace(/\[DATE_OF_SERVICE_IF_KNOWN\]/g, "[Approximate Date of Service]")
        .replace(/\[TYPE_OF_DEBT_e_g_written_contract_credit_card_debt\]/g, "[Type of Debt]")
        .replace(/\[YOUR_STATE_OF_RESIDENCE\]/g, userInfo.address_state || "[Your State of Residence]")
        .replace(/\[NUMBER\]/g, "[Number of Years for SOL]")
        .replace(/\[DATE_OF_LAST_PAYMENT_OR_ACTIVITY_IF_KNOWN\]/g, "[Date of Last Payment/Activity]")
        .replace(/\[DATE_OF_FIRST_DELINQUENCY_IF_KNOWN\]/g, "[Approximate Date of First Delinquency]")
        .replace(/\[NAME_OF_COMPANY_THAT_MADE_INQUIRY\]/g, "[Company Name for Inquiry]")
        .replace(/\[DATE_OF_INQUIRY\]/g, "[Date of Inquiry]")
        .replace(/\[YOUR_BUSINESS_NAME\]/g, "[Your Business Name]")
        .replace(/\[YOUR_BUSINESS_EIN\]/g, "[Your Business EIN]")
        .replace(/\[BUSINESS_STRUCTURE_e_g_Sole_Proprietorship_LLC_etc\]/g, "[Your Business Structure]")

      if (customDetails && !content.includes(customDetails)) {
        const closingIndex = content.lastIndexOf("Sincerely,")
        if (closingIndex !== -1) {
          content = `${content.substring(0, closingIndex)}\nAdditional Details Provided:\n${customDetails}\n\n${content.substring(closingIndex)}`
        } else {
          content += `\n\nAdditional Details Provided:\n${customDetails}`
        }
      }
      setLetterContent(content)

      if (user) {
        await supabase.from("dispute_letters").insert({
          user_id: user.id,
          letter_type: letterType,
          creditor_name: creditorName,
          account_number: accountNumber,
          letter_content: content,
          status: "draft",
        })
      }
      toast({ title: "Letter Generated" })
    } catch (error) {
      console.error("Letter generation error:", error)
      toast({ title: "Error Generating Letter", variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (!letterContent) return
    try {
      await navigator.clipboard.writeText(letterContent)
      setCopied(true)
      toast({ title: "Copied to clipboard!" })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({ title: "Failed to copy", variant: "destructive" })
    }
  }
  const downloadLetter = () => {
    if (!letterContent) return
    const blob = new Blob([letterContent], { type: "text/plain;charset=utf-8" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${letterType}_dispute_letter.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Text file download started." })
  }

  const generatePDF = async () => {
    if (!letterContent) return
    toast({ title: "Generating PDF...", description: "Please wait a moment." })
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlContent: `<pre style="white-space: pre-wrap; font-family: monospace;">${letterContent}</pre>`,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to generate PDF. Server error." }))
        throw new Error(errorData.message || `HTTP error ${response.status}`)
      }
      const blob = await response.blob()
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `${letterType}_dispute_letter.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast({ title: "PDF Downloaded", description: "Your PDF has been downloaded." })
    } catch (error) {
      console.error("PDF generation error:", error)
      toast({ title: "PDF Generation Failed", description: (error as Error).message, variant: "destructive" })
    }
  }

  const printLetter = () => {
    if (!letterContent) return
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`<pre style="white-space: pre-wrap; font-family: monospace;">${letterContent}</pre>`)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } else {
      toast({
        title: "Print Error",
        description: "Could not open print window. Check pop-up blocker.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-8">
      <Card className="p-6 bg-card/80 backdrop-blur">
        <h2 className="text-xl font-semibold mb-6">Generate Dispute Letter</h2>
        <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold">Important:</p>
              <p className="text-sm">
                Always send dispute letters via certified mail with return receipt requested. Keep copies of everything.
                The information provided here is for educational purposes and not legal advice.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="letterType">Letter Type</Label>
            <Select value={letterType} onValueChange={setLetterType}>
              <SelectTrigger id="letterType">
                <SelectValue placeholder="Select letter type" />
              </SelectTrigger>
              <SelectContent>
                {letterTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLetterDetails && (
            <Card className="mt-4 bg-muted/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Info className="h-5 w-5 mr-2 text-cyan-600" />
                  About: {selectedLetterDetails.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="font-semibold">Definition:</p>
                  <p>{selectedLetterDetails.definition}</p>
                </div>
                <div>
                  <p className="font-semibold">Best Used When:</p>
                  <p>{selectedLetterDetails.bestUse}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipient Select */}
          <div>
            <Label htmlFor="bureau">Recipient</Label>
            <Select value={bureau} onValueChange={setBureau}>
              <SelectTrigger id="bureau">
                <SelectValue placeholder="Select recipient" />
              </SelectTrigger>
              <SelectContent>
                {creditBureaus.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bureau === "custom" && (
            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
              <h3 className="text-sm font-medium">Custom Recipient Details</h3>
              <div>
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  value={customRecipient.name}
                  onChange={(e) => setCustomRecipient({ ...customRecipient, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="recipientAddress">Address</Label>
                <Input
                  id="recipientAddress"
                  value={customRecipient.address}
                  onChange={(e) => setCustomRecipient({ ...customRecipient, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="recipientCity">City</Label>
                  <Input
                    id="recipientCity"
                    value={customRecipient.city}
                    onChange={(e) => setCustomRecipient({ ...customRecipient, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="recipientState">State</Label>
                  <Input
                    id="recipientState"
                    value={customRecipient.state}
                    onChange={(e) => setCustomRecipient({ ...customRecipient, state: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="recipientZip">ZIP</Label>
                  <Input
                    id="recipientZip"
                    value={customRecipient.zip}
                    onChange={(e) => setCustomRecipient({ ...customRecipient, zip: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="creditorName">Creditor / Collection Agency / Disputed Company Name</Label>
            <Input
              id="creditorName"
              value={creditorName}
              onChange={(e) => setCreditorName(e.target.value)}
              placeholder="e.g., ABC Collections, XYZ Bank"
            />
          </div>

          <div>
            <Label htmlFor="accountNumber">Account Number (or other identifier if applicable)</Label>
            <Input
              id="accountNumber"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g., XXXX-XXXX-XXXX-1234, Inquiry ID"
            />
          </div>

          <div>
            <Label htmlFor="customDetails">
              Specific Details for Your Letter (Reason for dispute, dates, amounts, etc.)
            </Label>
            <Textarea
              id="customDetails"
              value={customDetails}
              onChange={(e) => setCustomDetails(e.target.value)}
              placeholder="Provide all relevant details for your specific situation. This will be used to fill in parts of the letter or added as additional information."
              rows={5}
            />
          </div>

          <div className="space-y-4 border rounded-md p-4 bg-muted/20">
            <h3 className="text-sm font-medium">
              Your Information (as it appears on your credit report or for identification)
            </h3>
            <div>
              <Label htmlFor="yourName">Your Full Name</Label>
              <Input
                id="yourName"
                value={userInfo.name}
                onChange={(e) => setUserInfo({ ...userInfo, name: e.target.value })}
                placeholder="Your Full Legal Name"
              />
            </div>
            <div>
              <Label htmlFor="yourAddress">Your Street Address</Label>
              <Input
                id="yourAddress"
                value={userInfo.address_street}
                onChange={(e) => setUserInfo({ ...userInfo, address_street: e.target.value })}
                placeholder="Street Address"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="yourCity">City</Label>
                <Input
                  id="yourCity"
                  value={userInfo.address_city}
                  onChange={(e) => setUserInfo({ ...userInfo, address_city: e.target.value })}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="yourState">State</Label>
                <Input
                  id="yourState"
                  value={userInfo.address_state}
                  onChange={(e) => setUserInfo({ ...userInfo, address_state: e.target.value })}
                  placeholder="State"
                />
              </div>
              <div>
                <Label htmlFor="yourZip">ZIP</Label>
                <Input
                  id="yourZip"
                  value={userInfo.address_zip}
                  onChange={(e) => setUserInfo({ ...userInfo, address_zip: e.target.value })}
                  placeholder="ZIP Code"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="yourPhone">Phone</Label>
                <Input
                  id="yourPhone"
                  type="tel"
                  value={userInfo.phone_number}
                  onChange={(e) => setUserInfo({ ...userInfo, phone_number: e.target.value })}
                  placeholder="Phone Number"
                />
              </div>
              <div>
                <Label htmlFor="yourEmail">Email</Label>
                <Input
                  id="yourEmail"
                  type="email"
                  value={userInfo.email}
                  onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                  placeholder="Email Address"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="yourDob">Date of Birth</Label>
                <Input
                  id="yourDob"
                  type="date"
                  value={userInfo.dob}
                  onChange={(e) => setUserInfo({ ...userInfo, dob: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="yourSsn">Social Security Number (SSN)</Label>
                <Input
                  id="yourSsn"
                  value={userInfo.ssn}
                  onChange={(e) => setUserInfo({ ...userInfo, ssn: e.target.value })}
                  placeholder="XXX-XX-XXXX (Required for ID with bureaus)"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Your SSN and DOB are often required by credit bureaus for identification. This information is used locally
              to generate the letter.
            </p>
          </div>

          <Button onClick={generateLetter} disabled={isGenerating} className="w-full bg-cyan-500 hover:bg-cyan-600">
            {isGenerating ? "Generating..." : "Generate Letter"}
          </Button>
        </div>
      </Card>

      {letterContent && (
        <Card className="p-6 bg-card/80 backdrop-blur">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
            <h2 className="text-xl font-semibold">Generated Letter</h2>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyToClipboard} variant="outline" size="sm" className="flex items-center gap-1">
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
              <Button onClick={downloadLetter} variant="outline" size="sm" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Text
              </Button>
              <Button onClick={generatePDF} variant="outline" size="sm" className="flex items-center gap-1">
                <FileDown className="h-4 w-4" />
                PDF
              </Button>
              <Button onClick={printLetter} variant="outline" size="sm" className="flex items-center gap-1">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
          <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto border">
            {letterContent}
          </div>
        </Card>
      )}
    </div>
  )
}
