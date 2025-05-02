const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

console.log("Checking for imports of react-day-picker in the codebase...")

try {
  // Use grep to find all imports of react-day-picker
  const result = execSync(
    'grep -r "from \'react-day-picker\'" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .',
    { encoding: "utf8" },
  )

  if (result.trim()) {
    console.log("Found imports of react-day-picker:")
    console.log(result)

    // Extract file paths
    const files = result
      .trim()
      .split("\n")
      .map((line) => {
        const match = line.match(/^([^:]+):/)
        return match ? match[1] : null
      })
      .filter(Boolean)

    console.log("Files with react-day-picker imports:")
    console.log(files)

    // You could automatically update these files here if needed
  } else {
    console.log("No imports of react-day-picker found")
  }
} catch (error) {
  // If the command fails, it likely means no matches were found
  console.log("No imports of react-day-picker found")
}
