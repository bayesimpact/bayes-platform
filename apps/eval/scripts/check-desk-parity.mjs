#!/usr/bin/env node
/**
 * Checks that the chat of Evaluation stays the Desk's. A tester talks to the agent through a copy
 * of the Desk's conversation code (`features/conversation`, and the Markdown it renders with):
 * the apps share no code, so a fix made in the Desk must reach Evaluation too.
 *
 * Each file is compared with the Desk's once the names that differ by app are aligned (the
 * contracts package, the route objects). The differences Evaluation keeps on purpose (no memory,
 * no history, the tester's feedback panel) are recorded in `desk-parity.json`, as one fingerprint
 * per file. A new difference, or a change to a recorded one, on either side, fails the check and
 * prints the diff: bring the change across, or, when the difference is wanted, record it with
 * `npm run check:desk-parity -- --update`.
 */
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const evalSource = join(appRoot, "src")
const deskSource = join(appRoot, "..", "desk", "src")
const baselinePath = join(appRoot, "scripts", "desk-parity.json")

/** The code both apps hold, relative to their `src`: folders are read whole. */
const SHARED_PATHS = [
  "features/conversation",
  "components/shared/Markdown.tsx",
  "components/shared/HighlightedCodeBlock.tsx",
  "components/shared/InlineCode.tsx",
]

/** The names that differ by app only, written as Evaluation writes them. */
const ALIGNED_NAMES = [
  ["@bayes-platform/desk-contracts", "@bayes-platform/eval-contracts"],
  [/\bDesk(\w*Routes)\b/g, "Eval$1"],
]

const isUpdate = process.argv.includes("--update")

function listFiles(root, path) {
  const absolute = join(root, path)
  if (!existsSync(absolute)) return []
  if (statSync(absolute).isFile()) return [path]
  return readdirSync(absolute).flatMap((entry) => listFiles(root, join(path, entry)))
}

function aligned(text) {
  return ALIGNED_NAMES.reduce((current, [from, to]) => current.replaceAll(from, to), text)
}

/**
 * The lines that differ from the Desk's file to Evaluation's, `-` for the Desk's and `+` for
 * Evaluation's, by the longest common run of lines; empty when the files match.
 */
function diffOf(path) {
  const deskFile = join(deskSource, path)
  const evalFile = join(evalSource, path)
  const deskText = existsSync(deskFile) ? aligned(readFileSync(deskFile, "utf8")) : ""
  const evalText = existsSync(evalFile) ? readFileSync(evalFile, "utf8") : ""
  if (deskText === evalText) return ""
  const deskLines = deskText.split("\n")
  const evalLines = evalText.split("\n")
  // common[i][j]: the longest common run of lines from deskLines[i] and evalLines[j] on.
  const common = Array.from({ length: deskLines.length + 1 }, () =>
    new Array(evalLines.length + 1).fill(0),
  )
  for (let deskIndex = deskLines.length - 1; deskIndex >= 0; deskIndex--) {
    for (let evalIndex = evalLines.length - 1; evalIndex >= 0; evalIndex--) {
      common[deskIndex][evalIndex] =
        deskLines[deskIndex] === evalLines[evalIndex]
          ? common[deskIndex + 1][evalIndex + 1] + 1
          : Math.max(common[deskIndex + 1][evalIndex], common[deskIndex][evalIndex + 1])
    }
  }
  const changes = [`--- desk/${path}`, `+++ eval/${path}`]
  let deskIndex = 0
  let evalIndex = 0
  while (deskIndex < deskLines.length || evalIndex < evalLines.length) {
    if (
      deskIndex < deskLines.length &&
      evalIndex < evalLines.length &&
      deskLines[deskIndex] === evalLines[evalIndex]
    ) {
      deskIndex++
      evalIndex++
    } else if (
      evalIndex === evalLines.length ||
      (deskIndex < deskLines.length &&
        common[deskIndex + 1][evalIndex] >= common[deskIndex][evalIndex + 1])
    ) {
      changes.push(`-${deskLines[deskIndex]}`)
      deskIndex++
    } else {
      changes.push(`+${evalLines[evalIndex]}`)
      evalIndex++
    }
  }
  return `${changes.join("\n")}\n`
}

const fingerprintOf = (diff) => createHash("sha256").update(diff).digest("hex").slice(0, 16)

const paths = [
  ...new Set(
    SHARED_PATHS.flatMap((path) => [
      ...listFiles(deskSource, path),
      ...listFiles(evalSource, path),
    ]),
  ),
].sort()

const current = {}
const diffs = {}
for (const path of paths) {
  const diff = diffOf(path)
  if (diff === "") continue
  current[path] = fingerprintOf(diff)
  diffs[path] = diff
}

if (isUpdate) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
  process.stdout.write(
    `Recorded ${Object.keys(current).length} wanted differences in ${relative(appRoot, baselinePath)}.\n`,
  )
  process.exit(0)
}

const recorded = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {}
const changed = paths.filter((path) => (current[path] ?? null) !== (recorded[path] ?? null))

if (changed.length === 0) {
  process.stdout.write(
    `The chat matches the Desk's (${paths.length} files, ${Object.keys(current).length} wanted differences).\n`,
  )
  process.exit(0)
}

console.error(`The chat drifted from the Desk's in ${changed.length} file(s):\n`)
for (const path of changed) {
  console.error(
    diffs[path] ?? `${path}: now identical to the Desk's, remove its recorded difference.\n`,
  )
}
console.error(
  "Bring the change across, or record a wanted difference with `npm run check:desk-parity -- --update`.",
)
process.exit(1)
