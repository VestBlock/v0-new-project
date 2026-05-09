'use client'

import { useState } from 'react'
import { Check, Loader2, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getSupabaseClient } from '@/lib/supabase/client'

type Props = {
  id: string
  approvalStatus: string
}

export function StrategyUpdateActions({ id, approvalStatus }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = getSupabaseClient()

  async function run(action: 'approve' | 'reject' | 'apply') {
    setLoading(action)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      await fetch(`/api/admin/improvement/strategy-updates/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action }),
      })

      window.location.reload()
    } finally {
      setLoading(null)
    }
  }

  if (approvalStatus === 'rejected' || approvalStatus === 'auto_applied') return null

  return (
    <div className="flex flex-wrap gap-2">
      {approvalStatus === 'queued' ? (
        <Button size="sm" variant="outline" onClick={() => run('approve')} disabled={Boolean(loading)}>
          {loading === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Approve
        </Button>
      ) : null}
      {approvalStatus === 'approved' ? (
        <Button size="sm" onClick={() => run('apply')} disabled={Boolean(loading)}>
          {loading === 'apply' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
          Apply
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => run('reject')} disabled={Boolean(loading)}>
        {loading === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
        Reject
      </Button>
    </div>
  )
}
