const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// Function to search for react-day-picker in a file
function searchFileForReactDayPicker(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8")
    return {
      path: filePath,
      hasImport: content.includes("from 'react-day-picker'") || content.includes('from "react-day-picker"'),
      hasComponent:
        content.includes("<DayPicker") ||
        content.includes("<Calendar") ||
        content.includes("<DatePicker") ||
        content.includes("<DateRangePicker"),
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error)
    return { path: filePath, hasImport: false, hasComponent: false }
  }
}

// Function to recursively search directories
function searchDirectory(dir) {
  let results = []

  try {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory() && !filePath.includes("node_modules") && !filePath.includes(".next")) {
        results = results.concat(searchDirectory(filePath))
      } else if (
        stat.isFile() &&
        (filePath.endsWith(".tsx") || filePath.endsWith(".jsx") || filePath.endsWith(".ts") || filePath.endsWith(".js"))
      ) {
        const searchResult = searchFileForReactDayPicker(filePath)
        if (searchResult.hasImport || searchResult.hasComponent) {
          results.push(searchResult)
        }
      }
    }
  } catch (error) {
    console.error(`Error searching directory ${dir}:`, error)
  }

  return results
}

// Main function
function findReactDayPicker() {
  console.log("Searching for react-day-picker usage...")

  // Start search from the current directory
  const results = searchDirectory(".")

  console.log("\nFiles using react-day-picker:")
  if (results.length === 0) {
    console.log("No files found using react-day-picker.")
  } else {
    results.forEach((result) => {
      console.log(`- ${result.path}`)
      if (result.hasImport) console.log("  Has import from react-day-picker")
      if (result.hasComponent) console.log("  Uses react-day-picker components")
    })
  }

  console.log(`\nTotal files found: ${results.length}`)
}

// Run the search
findReactDayPicker()
