export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Lazy-initialize Resend to avoid build-time errors
let resend: Resend | null = null;
function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const {
      businessName,
      contactName,
      email,
      phone,
      websiteUrl,
      industry,
      hasBookingSoftware,
      bookingSoftwareName,
      notes
    } = data;

    // Validate required fields
    if (!businessName || !contactName || !email || !phone || !websiteUrl || !industry) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Build email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">New AI Assistant Setup Request</h2>
        <hr style="border: 1px solid #e5e7eb;" />

        <h3>Business Information</h3>
        <p><strong>Business Name:</strong> ${businessName}</p>
        <p><strong>Contact Name:</strong> ${contactName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Website:</strong> <a href="${websiteUrl}">${websiteUrl}</a></p>
        <p><strong>Industry:</strong> ${industry}</p>

        <h3>Booking Software</h3>
        <p><strong>Currently using booking software:</strong> ${hasBookingSoftware || 'Not specified'}</p>
        ${hasBookingSoftware === 'yes' ? `<p><strong>Software:</strong> ${bookingSoftwareName || 'Not specified'}</p>` : ''}

        ${notes ? `
        <h3>Additional Notes</h3>
        <p>${notes}</p>
        ` : ''}

        <hr style="border: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Submitted at: ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    // Save to unified leads table
    try {
      const { error: leadsError } = await supabaseAdmin
        .from('leads')
        .insert({
          lead_type: 'ai_assistant',
          status: 'new',
          name: contactName,
          email: email,
          phone: phone,
          contact_info: {
            name: contactName,
            email: email,
            phone: phone
          },
          form_data: {
            businessName,
            websiteUrl,
            industry,
            hasBookingSoftware,
            bookingSoftwareName,
            notes
          }
        });

      if (leadsError) {
        console.error('Leads table error:', leadsError);
      }
    } catch (dbErr) {
      console.error('Database error:', dbErr);
      // Don't fail the request if database fails
    }

    // Send email notification
    try {
      const resendClient = getResend();
      if (resendClient) {
        const { error: emailError } = await resendClient.emails.send({
          from: process.env.RESEND_EMAIL || 'noreply@vestblock.io',
          to: 'contact@vestblock.io',
          subject: `AI Assistant Request - ${businessName}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error('Email send error:', emailError);
        } else {
          console.log('Email notification sent successfully');
        }
      } else {
        console.warn('Resend API key not configured, skipping email');
      }
    } catch (emailErr) {
      console.error('Email error:', emailErr);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Request submitted successfully'
    });

  } catch (error: any) {
    console.error('AI Assistant request error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
