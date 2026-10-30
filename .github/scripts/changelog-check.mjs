/**
 * Gate on CHANGELOG.md: new entries go under `## [Unreleased]`, never under a released version.
 *
 * Fails the PR when the merge of its head into the current base adds or changes a line at or
 * below the first released heading (`## [YY.MM.N] - date`). Removing lines there passes, so a PR
 * can still move a misplaced entry back to `[Unreleased]`.
 *
 * Why the merge, not the PR head: a branch cut before a release adds its entry under what is
 * `[Unreleased]` on the branch. Once the release workflow promotes that section to a version on
 * the base, git merges the line next to the same context, now under the released heading, with no
 * conflict. Only the merge result shows it.
 *
 * Inputs (env): BASE_SHA (default HEAD^1, the base tip in the pull_request merge commit),
 * HEAD_SHA (default HEAD, that merge commit), HEAD_REF and PR_AUTHOR (the release bot's
 * promotion PR is exempt: it turns `[Unreleased]` into a versioned heading).
 *
 * Local dry run of the current branch merged into the current main:
 *   git fetch origin main
 *   BASE_SHA=origin/main HEAD_SHA=$(git merge-tree --write-tree origin/main HEAD) \
 *     node .github/scripts/changelog-check.mjs
 *
 * Tests: node --test .github/scripts/
 */
import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const CHANGELOG = "CHANGELOG.md"
const RELEASED_HEADING = /^## \[\d{2}\.\d{2}\.\d+\]/
const RELEASE_BRANCH_PREFIX = "chore/changelog-v"
const RELEASE_AUTHORS = ["github-actions[bot]", "bayes-release-bot", "bayes-release-bot[bot]"]

/** 1-based line number of the first released heading, or null when nothing is released. */
export function firstReleasedHeadingLine(changelog) {
  const index = changelog.split("\n").findIndex((line) => RELEASED_HEADING.test(line))
  return index === -1 ? null : index + 1
}

/** Lines added by a unified diff, with their line number in the new file. */
export function addedLines(diff) {
  const added = []
  let newLine = null
  for (const line of diff.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) {
      newLine = Number(hunk[1])
      continue
    }
    if (newLine === null || line.startsWith("+++")) continue
    if (line.startsWith("+")) {
      added.push({ lineNumber: newLine, text: line.slice(1) })
      newLine += 1
    } else if (line.startsWith(" ")) {
      newLine += 1
    }
  }
  return added
}

/** Non-blank lines the diff adds at or below the first released heading of the new changelog. */
export function releasedAdditions({ diff, changelog }) {
  const heading = firstReleasedHeadingLine(changelog)
  if (heading === null) return []
  return addedLines(diff).filter((line) => line.lineNumber >= heading && line.text.trim() !== "")
}

export function isReleasePromotion({ headRef, author }) {
  return (
    Boolean(headRef?.startsWith(RELEASE_BRANCH_PREFIX)) && RELEASE_AUTHORS.includes(author ?? "")
  )
}

function main() {
  const baseSha = process.env.BASE_SHA || "HEAD^1"
  const headSha = process.env.HEAD_SHA || "HEAD"
  const headRef = process.env.HEAD_REF
  const author = process.env.PR_AUTHOR
  const lines = ["## Changelog gate", ""]
  let failed = false

  if (isReleasePromotion({ headRef, author })) {
    lines.push(`Release promotion PR (${headRef} by ${author}): skipped.`)
  } else {
    const diff = git("diff", "-U0", baseSha, headSha, "--", CHANGELOG)
    const changelog = git("show", `${headSha}:${CHANGELOG}`)
    const offending = releasedAdditions({ diff, changelog })
    if (offending.length === 0) {
      lines.push("No line added under a released version.", "", "Result: pass.")
    } else {
      failed = true
      lines.push(
        `Once merged into the current base, this PR adds lines under a released version of ${CHANGELOG}:`,
        "",
        ...offending.map((line) => `- line ${line.lineNumber}: \`${line.text.trim()}\``),
        "",
        "The base was probably released after this branch was cut. Merge the base into the branch and move these entries under `## [Unreleased]`.",
        "",
        "Result: fail.",
      )
      for (const line of offending) {
        console.log(
          `::error file=${CHANGELOG},line=${line.lineNumber}::Entry under a released version. Move it under ## [Unreleased].`,
        )
      }
    }
  }

  const text = lines.join("\n")
  console.log(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
  process.exit(failed ? 1 : 0)
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" })
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
