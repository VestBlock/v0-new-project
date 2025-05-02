const { execSync } = require("child_process")
const fs = require("fs")

// Function to execute a command and log the output
function runCommand(command) {
  console.log(`Running: ${command}`)
  try {
    execSync(command, { stdio: "inherit" })
  } catch (error) {
    console.error(`Command failed: ${command}`)
    console.error(error)
    process.exit(1)
  }
}

// Main function
async function main() {
  console.log("Starting custom build process...")

  // Check current node version
  runCommand("node --version")

  // Force install React 18.2.0 first
  console.log("Installing React 18.2.0...")
  runCommand("npm install react@18.2.0 react-dom@18.2.0 --save-exact --no-package-lock")

  // Install dependencies with legacy-peer-deps
  console.log("Installing all dependencies...")
  runCommand("npm install --legacy-peer-deps")

  // Check what version of React is installed
  console.log("Checking React version...")
  runCommand("npm ls react")

  // Build the project
  console.log("Building the project...")
  runCommand("npm run build")

  console.log("Build completed successfully!")
}

main().catch((error) => {
  console.error("Build failed:", error)
  process.exit(1)
})
