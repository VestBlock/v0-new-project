"use client"

import type React from "react"
import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "./ui/button"

type SuperDisputeFormProps = {}

const SuperDisputeForm: React.FC<SuperDisputeFormProps> = ({/* props */}) => {
  const [showCryptoPayment, setShowCryptoPayment] = useState(false) // Example state
  const [selectedPlan, setSelectedPlan] = useState<{ price: number; cryptoPrice: number } | null>(null) // Example state
  const [cryptoWalletAddress, setCryptoWalletAddress] = useState("bc1qxyz...") // Example state

  const handleConfirmCryptoPayment = () => {
    // Implement your logic here
    alert("Payment Confirmed (Placeholder)")
  }

  return (
    <div>
      <h1>Super Dispute Form</h1>
      {/* Your form elements here */}

      {showCryptoPayment && selectedPlan && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg text-center">
          <h4 className="text-lg font-semibold text-cyan-400 mb-2">Pay with Crypto</h4>
          <p className="text-sm text-gray-300 mb-2">
            Scan the QR code or copy the address below to pay {selectedPlan.price}.
          </p>
          <div className="bg-white p-2 rounded inline-block">
            <QRCodeSVG value={`bitcoin:${cryptoWalletAddress}?amount=${selectedPlan.cryptoPrice}`} size={160} />
          </div>
          <p className="mt-2 text-xs text-gray-400 break-all">{cryptoWalletAddress}</p>
          <Button onClick={handleConfirmCryptoPayment} className="mt-3 bg-green-500 hover:bg-green-600">
            I've Sent The Payment
          </Button>
        </div>
      )}
    </div>
  )
}

export default SuperDisputeForm
