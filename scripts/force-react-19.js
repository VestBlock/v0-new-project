const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

console.log("Forcing React 19 in all dependencies...")

// Function to update package.json
function updatePackageJson() {
  const packageJsonPath = path.join(process.cwd(), "package.json")

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

      // Update React and React DOM to version 19
      if (packageJson.dependencies) {
        if (packageJson.dependencies.react) {
          packageJson.dependencies.react = "^19.0.0"
        }
        if (packageJson.dependencies["react-dom"]) {
          packageJson.dependencies["react-dom"] = "^19.0.0"
        }

        // Remove react-day-picker if it exists
        if (packageJson.dependencies["react-day-picker"]) {
          delete packageJson.dependencies["react-day-picker"]
        }
      }

      // Write updated package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
      console.log("Updated package.json to use React 19")
    } catch (error) {
      console.error("Error updating package.json:", error)
    }
  }
}

// Function to update all package.json files in node_modules
function updateNodeModulesPackageJson() {
  const nodeModulesPath = path.join(process.cwd(), "node_modules")

  if (!fs.existsSync(nodeModulesPath)) {
    console.log("node_modules directory not found")
    return
  }

  // Find all package.json files in node_modules
  try {
    const result = execSync('find ./node_modules -name "package.json" -type f', { encoding: "utf8" })

    if (result.trim()) {
      const files = result.trim().split("\n")

      files.forEach((filePath) => {
        try {
          const packageJson = JSON.parse(fs.readFileSync(filePath, "utf8"))

          // Update peerDependencies to accept React 19
          if (packageJson.peerDependencies) {
            if (packageJson.peerDependencies.react) {
              packageJson.peerDependencies.react = ">=16.8.0"
            }
            if (packageJson.peerDependencies["react-dom"]) {
              packageJson.peerDependencies["react-dom"] = ">=16.8.0"
            }
          }

          // Write updated package.json
          fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2))
        } catch (error) {
          // Ignore errors for individual files
        }
      })

      console.log(`Updated peerDependencies in ${files.length} package.json files`)
    }
  } catch (error) {
    console.error("Error updating node_modules package.json files:", error)
  }
}

// Main function
function main() {
  updatePackageJson()
  updateNodeModulesPackageJson()
  console.log("Completed forcing React 19")
}

main()
