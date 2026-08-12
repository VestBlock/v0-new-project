import type { Metadata } from "next"
import { NextMoveManage } from "@/components/next-move/next-move-manage"

export const metadata: Metadata = { title: "Manage Next-Move data | VestBlock", robots: { index: false, follow: false } }

export const dynamic = "force-dynamic"

export default async function NextMoveManagePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams
  return <NextMoveManage token={params.token || ""} />
}
