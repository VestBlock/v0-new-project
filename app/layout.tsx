import type React from 'react';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { GoogleAdsProvider } from '@/components/providers/google-ads-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation'; // Corrected import
import { SiteFooter } from '@/components/site-footer';
import {
  absoluteUrl,
  getSiteUrl,
  vestBlockDefaultDescription,
  vestBlockDefaultTitle,
  vestBlockSiteName,
} from '@/lib/seo/site';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structuredData';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: vestBlockDefaultTitle,
    template: `%s | ${vestBlockSiteName}`,
  },
  description: vestBlockDefaultDescription,
  alternates: {
    canonical: '/',
  },
  applicationName: vestBlockSiteName,
  authors: [{ name: vestBlockSiteName, url: absoluteUrl('/') }],
  creator: vestBlockSiteName,
  publisher: vestBlockSiteName,
  category: 'Business services and opportunity coordination',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '512x512' }],
    shortcut: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  keywords: [
    'AI-guided next move platform',
    'business capital preparation',
    'capital readiness',
    'business acquisition opportunities',
    'deal pathways',
    'financial readiness roadmap',
    'business growth resources',
    'opportunity coordination',
    'decision support platform',
    'DealVault active work records',
    'seller property review',
    'buyer buy box network',
    'private lender network',
    'real estate funding',
    'developer contractor partner network',
  ],
  openGraph: {
    type: 'website',
    siteName: vestBlockSiteName,
    url: absoluteUrl('/'),
    title: vestBlockDefaultTitle,
    description: vestBlockDefaultDescription,
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock AI-guided next-move platform for Capital, Real Estate, Opportunity, and DealVault',
        type: 'image/png',
      },
      {
        url: absoluteUrl('/vestblock-mark-platform-ai-3d.png'),
        width: 1254,
        height: 1254,
        alt: 'VestBlock compact AI platform mark',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: vestBlockDefaultTitle,
    description: vestBlockDefaultDescription,
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        alt: 'VestBlock AI-guided next-move platform',
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
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
  themeColor: '#06090c',
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
            <SiteFooter />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
