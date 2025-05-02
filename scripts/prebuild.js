const { execSync } = require("child_process")

console.log("Running prebuild scripts...")

// Run the purge-react-day-picker script
console.log("Purging react-day-picker...")
execSync("node scripts/purge-react-day-picker.js", { stdio: "inherit" })

// Run the force-react-19 script
console.log("Forcing React 19...")
execSync("node scripts/force-react-19.js", { stdio: "inherit" })

console.log("Prebuild complete.")
