const fs = require("fs")
const path = require("path")

// Function to recursively find package.json files
function findPackageJsonFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)

  files.forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory() && !filePath.includes("node_modules")) {
      findPackageJsonFiles(filePath, fileList)
    } else if (file === "package.json" && !filePath.includes("node_modules")) {
      fileList.push(filePath)
    }
  })

  return fileList
}

// Function to update package.json files
function updatePackageJson(filePath) {
  const packageJson = JSON.parse(fs.readFileSync(filePath, "utf8"))

  // Force React 18.2.0
  if (packageJson.dependencies && packageJson.dependencies.react) {
    packageJson.dependencies.react = "18.2.0"
  }

  if (packageJson.dependencies && packageJson.dependencies["react-dom"]) {
    packageJson.dependencies["react-dom"] = "18.2.0"
  }

  // Add or update resolutions
  packageJson.resolutions = {
    ...packageJson.resolutions,
    react: "18.2.0",
    "react-dom": "18.2.0",
    "react-day-picker": "8.8.0",
  }

  // Add or update overrides
  packageJson.overrides = {
    ...packageJson.overrides,
    react: "18.2.0",
    "react-dom": "18.2.0",
    "react-day-picker": "8.8.0",
  }

  fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2))
  console.log(`Updated ${filePath}`)
}

// Main function
function main() {
  const rootDir = process.cwd()
  const packageJsonFiles = findPackageJsonFiles(rootDir)

  packageJsonFiles.forEach(updatePackageJson)
  console.log("All package.json files updated to force React 18.2.0")
}

main()
