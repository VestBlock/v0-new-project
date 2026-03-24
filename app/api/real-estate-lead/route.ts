import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

// Lazy initialization to avoid build-time errors
let resend: Resend | null = null
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const {
      loanType,
      fullName,
      email,
      phone,
      creditScoreRange,
      // DSCR fields
      entity,
      propertyAddress,
      propertyType,
      purchasePrice,
      expectedRent,
      occupancy,
      downPaymentLtv,
      closingDate,
      notes,
      // Hard Money fields
      experienceLevel,
      rehabBudget,
      arv,
      exitStrategy,
      closingTimeline,
      fundsNeeded
    } = data

    // Build email content based on loan type
    let emailContent = `
<h2>New Real Estate Funding Lead</h2>
<p><strong>Loan Type:</strong> ${loanType === 'dscr' ? 'DSCR Loan' : 'Hard Money / Fix & Flip'}</p>

<h3>Borrower Information</h3>
<ul>
  <li><strong>Full Name:</strong> ${fullName}</li>
  <li><strong>Email:</strong> ${email}</li>
  <li><strong>Phone:</strong> ${phone}</li>
  <li><strong>Credit Score Range:</strong> ${creditScoreRange || 'Not provided'}</li>
  ${loanType === 'dscr' ? `<li><strong>Entity:</strong> ${entity}</li>` : ''}
  ${loanType === 'hard-money' ? `<li><strong>Experience Level:</strong> ${experienceLevel}</li>` : ''}
</ul>
`

    if (loanType === 'dscr') {
      emailContent += `
<h3>Property Information</h3>
<ul>
  <li><strong>Property Address:</strong> ${propertyAddress}</li>
  <li><strong>Property Type:</strong> ${propertyType}</li>
  <li><strong>Purchase Price:</strong> ${purchasePrice}</li>
  <li><strong>Expected Rent (Monthly):</strong> ${expectedRent}</li>
  <li><strong>Occupancy:</strong> ${occupancy}</li>
  <li><strong>Down Payment / LTV:</strong> ${downPaymentLtv}</li>
</ul>

<h3>Timing</h3>
<ul>
  <li><strong>Target Closing Date:</strong> ${closingDate}</li>
  ${notes ? `<li><strong>Notes:</strong> ${notes}</li>` : ''}
</ul>
`
    } else {
      emailContent += `
<h3>Deal Information</h3>
<ul>
  <li><strong>Property Address:</strong> ${propertyAddress}</li>
  <li><strong>Purchase Price:</strong> ${purchasePrice}</li>
  <li><strong>Rehab Budget:</strong> ${rehabBudget}</li>
  <li><strong>ARV (After Repair Value):</strong> ${arv}</li>
  <li><strong>Exit Strategy:</strong> ${exitStrategy}</li>
  <li><strong>Closing Timeline:</strong> ${closingTimeline}</li>
  <li><strong>Funds Needed:</strong> ${fundsNeeded}</li>
</ul>
`
    }

    emailContent += `
<hr>
<p style="color: #666; font-size: 12px;">
  Submitted from VestBlock Real Estate Funding page at ${new Date().toLocaleString()}
</p>
`

    const resendClient = getResend()

    if (resendClient) {
      await resendClient.emails.send({
        from: "VestBlock <noreply@vestblock.io>",
        to: process.env.LEAD_EMAIL || "leads@vestblock.io",
        replyTo: email,
        subject: `[Real Estate Lead] ${loanType === 'dscr' ? 'DSCR' : 'Hard Money'} - ${fullName}`,
        html: emailContent
      })
    } else {
      console.log("Resend not configured. Lead data:", data)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Real estate lead submission error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit lead" },
      { status: 500 }
    )
  }
}
