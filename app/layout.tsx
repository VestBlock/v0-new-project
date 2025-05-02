import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/lib/auth-provider"
import { Navbar } from "@/components/navbar"
import { NotificationProvider } from "@/lib/notification-provider"
import { Analytics } from "@/components/analytics"
import { Footer } from "@/components/footer"
import { Suspense } from "react"
import { ReactVersionChecker } from "@/components/react-version-checker"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "VestBlock - AI-Powered Credit Repair & Financial Empowerment",
  description:
    "Analyze your credit report, generate dispute letters, and get personalized financial strategies with our AI-powered platform.",
    generator: 'v0.dev'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <NotificationProvider>
              <div className="flex min-h-screen flex-col">
                <Suspense>
                  <Navbar />
                </Suspense>
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
              <Toaster />
              <Analytics />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV !== "production" && <ReactVersionChecker />}
      </body>
    </html>
  )
}
