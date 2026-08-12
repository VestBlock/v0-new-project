import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { GoogleAdsProvider } from '@/components/providers/google-ads-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation'; // Corrected import
import {
  absoluteUrl,
  getSiteUrl,
  vestBlockDefaultDescription,
  vestBlockSiteName,
} from '@/lib/seo/site';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structuredData';

const inter = Inter({ subsets: ['latin'] });

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
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock Capital, Deals, and Opportunity platform preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${vestBlockSiteName} - Find Your Next Move`,
    description: vestBlockDefaultDescription,
    images: [absoluteUrl('/opengraph-image')],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
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
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
