import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

import { JoinPageClient } from '@/components/auth/join-page-client'

export const dynamic = 'force-dynamic'

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <JoinPageClient />
    </Suspense>
  )
}
