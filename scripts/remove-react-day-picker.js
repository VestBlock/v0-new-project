const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

console.log("Checking for react-day-picker in node_modules...")

// Function to check if react-day-picker exists in node_modules
function checkForReactDayPicker() {
  const reactDayPickerPath = path.join(process.cwd(), "node_modules", "react-day-picker")
  return fs.existsSync(reactDayPickerPath)
}

// Function to remove react-day-picker from node_modules
function removeReactDayPicker() {
  console.log("Removing react-day-picker from node_modules...")
  try {
    const reactDayPickerPath = path.join(process.cwd(), "node_modules", "react-day-picker")
    if (fs.existsSync(reactDayPickerPath)) {
      fs.rmSync(reactDayPickerPath, { recursive: true, force: true })
      console.log("Successfully removed react-day-picker from node_modules")
    }
  } catch (error) {
    console.error("Error removing react-day-picker:", error)
  }
}

// Function to check package-lock.json for react-day-picker
function checkPackageLock() {
  console.log("Checking package-lock.json for react-day-picker...")
  const packageLockPath = path.join(process.cwd(), "package-lock.json")

  if (fs.existsSync(packageLockPath)) {
    try {
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, "utf8"))

      // Check if react-day-picker is in dependencies
      if (packageLock.dependencies && packageLock.dependencies["react-day-picker"]) {
        console.log("Found react-day-picker in package-lock.json dependencies")
        delete packageLock.dependencies["react-day-picker"]
      }

      // Check if react-day-picker is in packages
      if (packageLock.packages) {
        Object.keys(packageLock.packages).forEach((pkg) => {
          if (pkg.includes("react-day-picker")) {
            console.log(`Found react-day-picker in package-lock.json packages: ${pkg}`)
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
}

// Main function
function main() {
  if (checkForReactDayPicker()) {
    removeReactDayPicker()
  } else {
    console.log("react-day-picker not found in node_modules")
  }

  checkPackageLock()

  console.log("Checking for any remaining references to react-day-picker...")
  try {
    const result = execSync('find ./node_modules -name "react-day-picker" -type d', { encoding: "utf8" })
    if (result.trim()) {
      console.log("Found additional references to react-day-picker:")
      console.log(result)

      // Remove any found references
      result
        .trim()
        .split("\n")
        .forEach((path) => {
          if (path) {
            console.log(`Removing ${path}...`)
            fs.rmSync(path, { recursive: true, force: true })
          }
        })
    } else {
      console.log("No additional references found")
    }
  } catch (error) {
    // If the command fails, it likely means no matches were found
    console.log("No additional references found")
  }

  console.log("Cleanup complete")
}

main()
