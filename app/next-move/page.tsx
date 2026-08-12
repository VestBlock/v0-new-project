import type { Metadata } from "next"
import { NextMoveQuestionnaire } from "@/components/next-move/next-move-questionnaire"
import { nextMoveFocuses, type NextMoveFocus } from "@/lib/next-move/types"

export const metadata: Metadata = {
  title: "Free Next-Move Questionnaire | VestBlock",
  description: "Answer a few focused questions and receive a free educational VestBlock analysis with an ordered 7, 30, 60, and 90-day roadmap.",
  alternates: { canonical: "/next-move" },
}

export const dynamic = "force-dynamic"

export default async function NextMovePage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const params = await searchParams
  const initialFocus = nextMoveFocuses.includes(params.focus as NextMoveFocus) ? params.focus as NextMoveFocus : undefined
  return <NextMoveQuestionnaire initialFocus={initialFocus} />
}
