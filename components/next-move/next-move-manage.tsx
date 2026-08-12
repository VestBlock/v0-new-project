"use client"

import Link from "next/link"
import { useState } from "react"
import { Download, Trash2 } from "lucide-react"

export function NextMoveManage({ token }: { token: string }) {
  const [status, setStatus] = useState("")
  const [working, setWorking] = useState(false)

  async function act(action: "export" | "delete") {
    if (action === "delete" && !window.confirm("Delete the personal data connected to this Next-Move questionnaire? This cannot be undone.")) return
    setWorking(true); setStatus("")
    try {
      const response = await fetch("/api/next-move/manage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "The request could not be completed.")
      if (action === "export") {
        const blob = new Blob([JSON.stringify(data.record, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "vestblock-next-move-export.json"; anchor.click(); URL.revokeObjectURL(url)
        setStatus("Your data export was downloaded.")
      } else setStatus("Your questionnaire personal data was deleted and related follow-up was stopped.")
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "The request could not be completed.") }
    finally { setWorking(false) }
  }

  return <main className="vb-manage-data"><section><p className="vb-kicker">Privacy control</p><h1>Manage your Next-Move data.</h1><p>Use the secure link from your roadmap email to export the questionnaire data VestBlock stored or delete the personal data and stop its related follow-up task.</p>{!token ? <p className="vb-questionnaire__error">This page needs the secure link included with your roadmap.</p> : <div><button className="vb-button vb-button--quiet" disabled={working} onClick={() => act("export")}><Download aria-hidden="true" />Export my data</button><button className="vb-button vb-button--quiet vb-button--danger" disabled={working} onClick={() => act("delete")}><Trash2 aria-hidden="true" />Delete my data</button></div>}{status && <p role="status" className="vb-manage-data__status">{status}</p>}<Link href="/next-move">Return to the questionnaire</Link></section></main>
}
