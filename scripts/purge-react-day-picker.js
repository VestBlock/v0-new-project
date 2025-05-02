const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

console.log("Purging react-day-picker from the project...")

// Check if package.json exists
const packageJsonPath = path.join(process.cwd(), "package.json")
if (fs.existsSync(packageJsonPath)) {
  try {
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

    // Remove react-day-picker from dependencies
    if (packageJson.dependencies && packageJson.dependencies["react-day-picker"]) {
      console.log("Removing react-day-picker from dependencies...")
      delete packageJson.dependencies["react-day-picker"]
    }

    // Write updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    console.log("Updated package.json")
  } catch (error) {
    console.error("Error updating package.json:", error)
  }
}

// Check if package-lock.json exists
const packageLockPath = path.join(process.cwd(), "package-lock.json")
if (fs.existsSync(packageLockPath)) {
  try {
    // Read package-lock.json
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"))

    // Remove react-day-picker from dependencies
    if (packageLock.dependencies && packageLock.dependencies["react-day-picker"]) {
      console.log("Removing react-day-picker from package-lock.json dependencies...")
      delete packageLock.dependencies["react-day-picker"]
    }

    // Remove react-day-picker from packages
    if (packageLock.packages) {
      Object.keys(packageLock.packages).forEach((pkg) => {
        if (pkg.includes("react-day-picker")) {
          console.log(`Removing ${pkg} from package-lock.json packages...`)
          delete packageLock.packages[pkg]
        }
      })
    }

    // Write updated package-lock.json
    fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2))
    console.log("Updated package-lock.json")
  } catch (error) {
    console.error("Error updating package-lock.json:", error)
  }
}

// Check for react-day-picker in node_modules
const reactDayPickerPath = path.join(process.cwd(), "node_modules", "react-day-picker")
if (fs.existsSync(reactDayPickerPath)) {
  console.log("Removing react-day-picker from node_modules...")
  try {
    fs.rmSync(reactDayPickerPath, { recursive: true, force: true })
    console.log("Successfully removed react-day-picker from node_modules")
  } catch (error) {
    console.error("Error removing react-day-picker from node_modules:", error)
  }
}

// Find any imports of react-day-picker in the codebase
console.log("Checking for imports of react-day-picker in the codebase...")
try {
  const result = execSync(
    'grep -r "react-day-picker" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .',
    { encoding: "utf8" },
  )
  if (result.trim()) {
    console.log("Found imports of react-day-picker:")
    console.log(result)
    console.log("Please remove these imports manually.")
  } else {
    console.log("No imports of react-day-picker found.")
  }
} catch (error) {
  // If the command fails, it likely means no matches were found
  console.log("No imports of react-day-picker found.")
}

console.log("Purge complete.")
