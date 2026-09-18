import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { Manrope, Newsreader } from 'next/font/google';
import './globals.css';
import '@/styles/private-ledger.css';
import '@/styles/home-v3.css';
import { GoogleAdsProvider } from '@/components/providers/google-ads-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation'; // Corrected import
import { PublicSiteFooter } from '@/components/legal/public-site-footer';
import {
  absoluteUrl,
  getSiteUrl,
  vestBlockDefaultDescription,
  vestBlockSiteName,
} from '@/lib/seo/site';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structuredData';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-vb-sans',
  display: 'block',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-vb-display',
  display: 'block',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${vestBlockSiteName} - Find Your Next Move`,
    template: `%s | ${vestBlockSiteName}`,
  },
  description: vestBlockDefaultDescription,
  alternates: {
    canonical: '/',
  },
  applicationName: vestBlockSiteName,
  authors: [{ name: vestBlockSiteName, url: absoluteUrl('/') }],
  keywords: [
    'business capital preparation',
    'capital readiness',
    'business acquisition opportunities',
    'deal pathways',
    'business growth resources',
    'seller property review',
    'buyer buy box network',
    'private lender network',
    'DealVault records',
    'AI real estate intake',
    'search visibility for real estate',
    'AEO SEO booster for real estate',
    'real estate funding',
    'developer contractor partner network',
  ],
  openGraph: {
    type: 'website',
    siteName: vestBlockSiteName,
    url: absoluteUrl('/'),
    title: `${vestBlockSiteName} - Find Your Next Move`,
    description: vestBlockDefaultDescription,
    images: [
      {
        url: absoluteUrl('/opengraph-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock — find your next move across funding, real estate, and business growth',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${vestBlockSiteName} - Find Your Next Move`,
    description: vestBlockDefaultDescription,
    images: [
      {
        url: absoluteUrl('/twitter-image?v=3'),
        width: 1200,
        height: 630,
        alt: 'VestBlock — find your next move across funding, real estate, and business growth',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#0B0D0C',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${newsreader.variable} ${manrope.className}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd(), websiteJsonLd()]),
          }}
        />
        <GoogleAdsProvider />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <Navigation />
            <main>{children}</main>
            <PublicSiteFooter />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
