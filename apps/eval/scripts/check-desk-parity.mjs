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
import { execFileSync } from "node:child_process"
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
  ["@caseai-connect/desk-contracts", "@caseai-connect/eval-contracts"],
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

/** The unified diff from the Desk's file to Evaluation's, empty when they match. */
function diffOf(path) {
  const deskFile = join(deskSource, path)
  const evalFile = join(evalSource, path)
  const deskText = existsSync(deskFile) ? aligned(readFileSync(deskFile, "utf8")) : ""
  const evalText = existsSync(evalFile) ? readFileSync(evalFile, "utf8") : ""
  if (deskText === evalText) return ""
  const deskCopy = join(appRoot, "node_modules", ".desk-parity-desk")
  const evalCopy = join(appRoot, "node_modules", ".desk-parity-eval")
  writeFileSync(deskCopy, deskText)
  writeFileSync(evalCopy, evalText)
  try {
    execFileSync("diff", [
      "-u",
      "--label",
      `desk/${path}`,
      "--label",
      `eval/${path}`,
      deskCopy,
      evalCopy,
    ])
    return ""
  } catch (error) {
    // `diff` exits with 1 when the files differ, which is the case here.
    return String(error.stdout)
  }
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
  console.info(
    `Recorded ${Object.keys(current).length} wanted differences in ${relative(appRoot, baselinePath)}.`,
  )
  process.exit(0)
}

const recorded = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {}
const changed = paths.filter((path) => (current[path] ?? null) !== (recorded[path] ?? null))

if (changed.length === 0) {
  console.info(
    `The chat matches the Desk's (${paths.length} files, ${Object.keys(current).length} wanted differences).`,
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
