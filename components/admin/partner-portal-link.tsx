"use client"

import { useState } from 'react'
import { Check, Copy, Link2, Loader2, RefreshCw } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

type Props = {
  partnerType: 'lender' | 'buyer'
  partnerId: string
  partnerLabel: string
}

export function PartnerPortalLinkCard({ partnerType, partnerId, partnerLabel }: Props) {
  const supabase = getSupabaseClient()
  const { toast } = useToast()
  const [portalUrl, setPortalUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateLink = async () => {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Admin session expired.')

      const response = await fetch('/api/admin/partner-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partnerType, partnerId }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to create portal link.')

      setPortalUrl(data.url || '')
      setCopied(false)
      toast({
        title: `${partnerLabel} portal link ready`,
        description: 'A fresh invite-only portal link is ready to share.',
      })
    } catch (error) {
      toast({
        title: 'Portal link failed',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!portalUrl) return
    try {
      await navigator.clipboard.writeText(portalUrl)
      setCopied(true)
      toast({ title: 'Portal link copied' })
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({
        title: 'Copy failed',
        description: 'The link is still visible here to copy manually.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-white">Partner portal</CardTitle>
          <p className="mt-1 text-sm text-slate-400">
            Create an invite-only dashboard link so this {partnerLabel.toLowerCase()} can update criteria and respond to opportunities directly.
          </p>
        </div>
        <Button variant="outline" onClick={generateLink} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : portalUrl ? <RefreshCw className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
          {portalUrl ? 'Rotate link' : 'Create link'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={portalUrl} readOnly placeholder="Generate a portal link to share with this partner." />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={copyLink} disabled={!portalUrl}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
