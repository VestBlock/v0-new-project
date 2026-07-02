'use client';

import Script from 'next/script';
import { useEffect } from 'react';

type GtagCommand = 'js' | 'config' | 'event';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: GtagCommand, target: string | Date, params?: Record<string, unknown>) => void;
  }
}

const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

const conversionLabels: Record<string, string | undefined> = {
  sell_property_lead:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_SELL_LEAD_CONVERSION_LABEL ||
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
  spanish_funding_cta:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_SPANISH_FUNDING_CONVERSION_LABEL ||
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
  bank_breezy_click:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_BANK_BREEZY_CONVERSION_LABEL ||
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
};

export function sendGoogleAdsConversion(
  action: string,
  value?: number,
  params?: Record<string, unknown>
) {
  if (!googleAdsId || !window.gtag) return;

  const label = conversionLabels[action];
  const baseParams = {
    value,
    currency: 'USD',
    event_category: 'Google Ads',
    event_label: action,
    ...params,
  };

  if (label) {
    window.gtag('event', 'conversion', {
      send_to: `${googleAdsId}/${label}`,
      ...baseParams,
    });
    return;
  }

  window.gtag('event', action, baseParams);
}

export function GoogleAdsProvider() {
  useEffect(() => {
    if (!googleAdsId) return;

    const handleConversionClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const trigger = target?.closest<HTMLElement>('[data-google-ads-conversion]');
      if (!trigger) return;

      const action = trigger.dataset.googleAdsConversion;
      if (!action) return;

      const value = trigger.dataset.googleAdsConversionValue
        ? Number.parseFloat(trigger.dataset.googleAdsConversionValue)
        : undefined;

      sendGoogleAdsConversion(action, Number.isFinite(value) ? value : undefined);
    };

    document.addEventListener('click', handleConversionClick);
    return () => document.removeEventListener('click', handleConversionClick);
  }, []);

  if (!googleAdsId) return null;

  return (
    <>
      <Script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-gtag" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${googleAdsId}');
        `}
      </Script>
    </>
  );
}
