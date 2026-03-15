import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { Navigation } from '@/components/navigation'; // Corrected import

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VestBlock - AI-Powered Financial Opportunity Platform',
  description: 'VestBlock helps entrepreneurs and investors unlock financial opportunities using AI. Upload your credit report, generate dispute letters, improve your approval odds, and discover funding options.',
  generator: 'v0.dev',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
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
