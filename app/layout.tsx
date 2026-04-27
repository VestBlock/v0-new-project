import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
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
    default: `${vestBlockSiteName} - AI Credit Repair, Funding, Grants, and Financial Growth`,
    template: `%s | ${vestBlockSiteName}`,
  },
  description: vestBlockDefaultDescription,
  alternates: {
    canonical: '/',
  },
  applicationName: vestBlockSiteName,
  authors: [{ name: vestBlockSiteName, url: absoluteUrl('/') }],
  keywords: [
    'AI credit repair',
    'credit dispute letters',
    'business funding',
    'credit card stacking',
    'business credit',
    'small business grants',
    'real estate funding',
    'Spanish business funding',
  ],
  openGraph: {
    type: 'website',
    siteName: vestBlockSiteName,
    url: absoluteUrl('/'),
    title: `${vestBlockSiteName} - AI Credit Repair, Funding, Grants, and Financial Growth`,
    description: vestBlockDefaultDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${vestBlockSiteName} - AI Credit Repair, Funding, Grants, and Financial Growth`,
    description: vestBlockDefaultDescription,
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
