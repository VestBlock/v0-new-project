do $$
begin
  alter table public.leads drop constraint if exists leads_lead_type_check;

  alter table public.leads
    add constraint leads_lead_type_check
    check (
      lead_type in (
        'sell_house',
        'real_estate',
        'ai_assistant',
        'business_funding',
        'credit_card_funding_strategy',
        'lead_intelligence',
        'new_business_filing',
        'code_violation',
        'google_places',
        'sam_opportunity',
        'website_upgrade',
        'gov_contract',
        'business_formation',
        'visibility_expansion'
      )
    );
end
$$;
