import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Assistant + Appointment Booking | VestBlock",
  description:
    "AI assistant that captures leads and books appointments automatically. Perfect for HVAC, roofing, dental, med spa, and auto repair businesses. Works 24/7.",
  openGraph: {
    title: "AI Assistant + Appointment Booking | VestBlock",
    description:
      "AI assistant that captures leads and books appointments automatically. Perfect for service businesses.",
    type: "website",
  },
}

export default function AIAssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
