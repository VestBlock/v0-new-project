import { CreditCard } from "lucide-react"

export function Logo({ className }: { className?: string }) {
  return (
    <div className="flex items-center gap-2">
      <CreditCard className="h-6 w-6 text-cyan-400" />
      <span className="font-orbitron text-xl font-bold">
        <span className="text-cyan-400">Vest</span>
        <span className="text-white">Block</span>
      </span>
    </div>
  )
}
