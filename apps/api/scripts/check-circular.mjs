#!/usr/bin/env node

// Compares current circular dependencies (from madge) against the committed
// baseline in baselines/madge-circular.json. Exits non-zero if any *new* cycle
// is introduced. Resolving an existing cycle is always allowed.
//
// Run this with `npm run check:circular` in apps/api.
// To (re)generate the baseline after resolving cycles, run
// `npm run check:circular:baseline`.

import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const apiRoot = join(__dirname, "..")
const baselinePath = join(apiRoot, "baselines/madge-circular.json")

const mode = process.argv[2] === "--write" ? "write" : "check"

const isWindowsRunning = process.platform === "win32"
const npx = isWindowsRunning ? "npx.cmd" : "npx"

const result = spawnSync(npx, ["madge", "--circular", "--json", "src"], {
  cwd: apiRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  shell: isWindowsRunning,
})

if (result.error) {
  console.error("Failed to run madge:", result.error.message)
  process.exit(2)
}

// madge exits 1 when cycles are present; that is expected, not an error for us.
let current
try {
  current = JSON.parse(result.stdout || "[]")
} catch (parseError) {
  console.error("madge did not return valid JSON. Raw output:")
  console.error(result.stdout)
  console.error(parseError.message)
  process.exit(2)
}

// Normalize a cycle so rotations are considered equal.
// [A, B, C], [B, C, A], [C, A, B] -> same key.
const canonicalKey = (cycle) => {
  if (cycle.length === 0) return ""
  let minIndex = 0
  for (let index = 1; index < cycle.length; index += 1) {
    if (cycle[index] < cycle[minIndex]) minIndex = index
  }
  const rotated = [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)]
  return rotated.join(" > ")
}

if (mode === "write") {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
  console.log(`Wrote ${current.length} cycle(s) to ${baselinePath}`)
  process.exit(0)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
} catch (readError) {
  console.error(`Could not read baseline at ${baselinePath}:`, readError.message)
  console.error("Run `npm run check:circular:baseline` first to create it.")
  process.exit(2)
}

const baselineKeys = new Set(baseline.map(canonicalKey))
const currentKeys = new Set(current.map(canonicalKey))

const introduced = current.filter((cycle) => !baselineKeys.has(canonicalKey(cycle)))
const resolved = baseline.filter((cycle) => !currentKeys.has(canonicalKey(cycle)))

if (introduced.length > 0) {
  console.error(
    `✖ ${introduced.length} new circular dependenc${introduced.length === 1 ? "y" : "ies"} introduced:`,
  )
  for (const cycle of introduced) {
    console.error(`  - ${cycle.join(" > ")}`)
  }
  console.error("")
  console.error("Fix the cycle, or (only if intentional) regenerate the baseline:")
  console.error("  npm run check:circular:baseline")
  process.exit(1)
}

if (resolved.length > 0) {
  console.log(
    `✓ ${resolved.length} cycle(s) resolved since baseline. Consider refreshing the baseline:`,
  )
  for (const cycle of resolved) {
    console.log(`  - ${cycle.join(" > ")}`)
  }
  console.log("  npm run check:circular:baseline")
}

console.log(
  `✓ No new circular dependencies. (${current.length} known; baseline has ${baseline.length}.)`,
)
