"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, ExternalLink } from "lucide-react"
import { QRCodeSVG } from "qrcode.react" // Corrected import

// ... rest of the component props interface
interface FundingReferralCardProps {
  creditScore: number | null | undefined
  hasBusiness: boolean | null | undefined
  showQrCode?: boolean
  className?: string
}

export function FundingReferralCard({
  creditScore,
  hasBusiness,
  showQrCode = false,
  className = "",
}: FundingReferralCardProps) {
  const referralLink = "https://opmmastery.referralrock.com/l/ROBERTSAND60/referral"

  if (!creditScore || creditScore < 680 || !hasBusiness) {
    return null
  }

  return (
    <Card
      className={`bg-gray-900 border border-cyan-600 text-white shadow-xl hover:shadow-cyan-500/50 transition-shadow duration-300 ${className}`}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-bold text-cyan-400 flex items-center">
            <span role="img" aria-label="briefcase" className="mr-2 text-2xl">
              💼
            </span>
            Unlock Business Funding
          </CardTitle>
          {creditScore >= 700 && (
            <Badge variant="destructive" className="bg-green-500 text-white border-green-600 animate-pulse">
              🔥 You Pre-Qualify!
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-gray-300 text-sm">
          You may qualify for up to <strong className="text-cyan-400">$250,000</strong> in business funding. If your
          score is over 700 and you have an active business, you can access high-limit business credit with no hard
          inquiry.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-300 pl-2">
          <li className="text-cyan-500">
            <span className="text-gray-300">EIN-only options available</span>
          </li>
          <li className="text-cyan-500">
            <span className="text-gray-300">Fast approvals & funding</span>
          </li>
          <li className="text-cyan-500">
            <span className="text-gray-300">No obligation to apply</span>
          </li>
        </ul>

        <div className="mt-1 mb-3 p-2 rounded-md bg-yellow-900/30 border border-yellow-700 flex items-center text-xs text-yellow-300">
          <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
          <span>
            Note: The referral link provided previously appeared to be inactive. Please verify the link works as
            expected.
          </span>
        </div>

        <Button
          asChild
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-all duration-300 transform hover:scale-105"
        >
          <a href={referralLink} target="_blank" rel="noopener noreferrer">
            Apply Now <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>

        {showQrCode && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg flex flex-col items-center">
            <p className="text-xs text-cyan-400 mb-2">Or scan with your phone:</p>
            <div className="bg-white p-2 rounded">
              <QRCodeSVG value={referralLink} size={128} bgColor="#FFFFFF" fgColor="#000000" level="Q" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
