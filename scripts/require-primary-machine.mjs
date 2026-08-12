import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const ROOT = process.cwd()
const CONFIG_FILE = path.join(ROOT, "config", "primary-machine.json")

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"))
  } catch {
    return {}
  }
}

const config = readConfig()
const currentHostname = os.hostname()
const currentShort = currentHostname.split(".")[0]
const primaryConfigured = String(process.env.VESTBLOCK_PRIMARY_HOSTNAME || config.primaryHostname || "").trim()
const primaryShort = primaryConfigured.split(".")[0]
const mode = String(process.env.VESTBLOCK_MACHINE_MODE || "").trim().toLowerCase()

if (!primaryConfigured) {
  console.error("Primary machine hostname is not configured. Set config/primary-machine.json or VESTBLOCK_PRIMARY_HOSTNAME.")
  process.exit(1)
}

if (mode === "primary") process.exit(0)
if (currentHostname === primaryConfigured || currentShort === primaryShort) process.exit(0)

console.error(
  [
    `Blocked on non-primary machine.`,
    `Current host: ${currentHostname}`,
    `Primary host: ${primaryConfigured}`,
    `This machine should stay command-center/review only for live export and outreach work.`,
  ].join(" ")
)
process.exit(2)
