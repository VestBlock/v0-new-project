import type React from "react"
import { Inter, Orbitron } from "next/font/google"
import type { Metadata } from "next"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-provider"
import { NotificationProvider } from "@/lib/notification-provider"
import { Analytics } from "@/components/analytics"
import Navbar from "@/components/navbar"
import "./globals.css"
import { Suspense } from "react"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
})

export const metadata: Metadata = {
  title: "VestBlock - AI Credit Repair & Financial Empowerment",
  description:
    "Analyze your credit, get personalized recommendations, and improve your financial future with AI-powered insights.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${orbitron.variable} font-sans bg-black text-white`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <NotificationProvider>
              <div className="flex min-h-screen flex-col">
                <Navbar />
                <Suspense>
                  <main className="flex-1">{children}</main>
                </Suspense>
              </div>
              <Analytics />
              <Toaster />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
