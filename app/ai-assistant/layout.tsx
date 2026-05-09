import type { Metadata } from "next"
import { absoluteUrl } from "@/lib/seo/site"

export const metadata: Metadata = {
  title: "AI Receptionist, Booking, And Website Upgrades | VestBlock",
  description:
    "Compare VestBlock AI receptionist, appointment-booking, and website-upgrade offers for service businesses that need stronger lead capture and conversion.",
  alternates: {
    canonical: "/ai-assistant",
  },
  openGraph: {
    title: "AI Receptionist, Booking, And Website Upgrades | VestBlock",
    description:
      "AI receptionist, booking, and website-upgrade services for service businesses that want stronger lead capture and more booked conversations.",
    type: "website",
    url: absoluteUrl("/ai-assistant"),
    images: [
      {
        url: absoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: "VestBlock AI assistant service preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Receptionist, Booking, And Website Upgrades | VestBlock",
    description:
      "AI receptionist, booking, and website-upgrade services for service businesses that want stronger lead capture and more booked conversations.",
    images: [absoluteUrl("/opengraph-image")],
  },
}

export default function AIAssistantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
