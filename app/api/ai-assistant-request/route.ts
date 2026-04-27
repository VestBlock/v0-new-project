export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation';

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

    // Save to unified leads table
    try {
      const supabaseAdmin = createAdminClient();
      const { data: lead, error: leadsError } = await supabaseAdmin
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
        })
        .select('id')
        .single();

      if (leadsError) {
        console.error('Leads table error:', leadsError);
      } else {
        await runNewLeadAutomation({
          leadId: lead.id,
          leadType: 'ai_assistant',
          name: contactName,
          email,
          phone,
          sourcePath: '/ai-assistant',
          summary: `${businessName} in ${industry}; website ${websiteUrl}.`,
          metadata: {
            businessName,
            websiteUrl,
            industry,
            hasBookingSoftware,
            bookingSoftwareName,
          },
        });
      }
    } catch (dbErr) {
      console.error('Database error:', dbErr);
      // Don't fail the request if database fails
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
