import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  addedLines,
  firstReleasedHeadingLine,
  isReleasePromotion,
  releasedAdditions,
} from "./changelog-check.mjs"

const SCRIPT = fileURLToPath(new URL("./changelog-check.mjs", import.meta.url))

const UNRELEASED = `# Changelog

## [Unreleased]

### Added

- Search: results can be sorted by date.
- Agents: each agent shows its last answer time.

### Fixed

- Uploads: large files no longer time out.

## [26.10.7] - 2026-10-20

### Added

- Exports: conversations can be exported to CSV.
`

// The release workflow's promotion of UNRELEASED to 26.10.8.
const PROMOTED = `# Changelog

## [Unreleased]

### Added

### Changed

### Fixed

### Security

## [26.10.8] - 2026-10-29

### Added

- Search: results can be sorted by date.
- Agents: each agent shows its last answer time.

### Fixed

- Uploads: large files no longer time out.

## [26.10.7] - 2026-10-20

### Added

- Exports: conversations can be exported to CSV.
`

const NEW_ENTRY = "- Tags: projects can be filtered by tag."

describe("firstReleasedHeadingLine", () => {
  it("finds the first versioned heading", () => {
    assert.equal(firstReleasedHeadingLine(PROMOTED), 13)
  })

  it("returns null when nothing is released", () => {
    assert.equal(firstReleasedHeadingLine("# Changelog\n\n## [Unreleased]\n"), null)
  })
})

describe("addedLines", () => {
  it("numbers added lines in the new file", () => {
    const diff = [
      "--- a/CHANGELOG.md",
      "+++ b/CHANGELOG.md",
      "@@ -3,0 +4,2 @@",
      "+first",
      "+second",
      "@@ -10 +12 @@",
      "-old",
      "+new",
    ].join("\n")
    assert.deepEqual(addedLines(diff), [
      { lineNumber: 4, text: "first" },
      { lineNumber: 5, text: "second" },
      { lineNumber: 12, text: "new" },
    ])
  })
})

describe("isReleasePromotion", () => {
  it("accepts the release bot on a promotion branch", () => {
    assert.ok(
      isReleasePromotion({ headRef: "chore/changelog-v26.10.8", author: "github-actions[bot]" }),
    )
  })

  it("rejects a person on a promotion branch", () => {
    assert.ok(!isReleasePromotion({ headRef: "chore/changelog-v26.10.8", author: "someone" }))
  })

  it("rejects the bot on another branch", () => {
    assert.ok(!isReleasePromotion({ headRef: "feat/tags", author: "github-actions[bot]" }))
  })
})

describe("changelog gate on a merge", () => {
  const repo = mkdtempSync(join(tmpdir(), "changelog-check-"))
  after(() => rmSync(repo, { recursive: true, force: true }))

  const git = (...args) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
    }).trim()
  const commit = (content, message) => {
    writeFileSync(join(repo, "CHANGELOG.md"), content)
    git("add", "CHANGELOG.md")
    git("commit", "-q", "-m", message)
    return git("rev-parse", "HEAD")
  }
  // After the last entry of the first "Added", as a branch appends to the section it sees.
  const addEntryUnderFirstAdded = (content) =>
    content.replace(
      "- Agents: each agent shows its last answer time.\n",
      `- Agents: each agent shows its last answer time.\n${NEW_ENTRY}\n`,
    )
  // Under the empty "Added" of a fresh [Unreleased].
  const addEntryUnderUnreleased = (content) =>
    content.replace("### Added\n\n", `### Added\n\n${NEW_ENTRY}\n\n`)
  const runCheck = (baseSha, headSha, extraEnv = {}) =>
    spawnSync("node", [SCRIPT], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: "",
        BASE_SHA: baseSha,
        HEAD_SHA: headSha,
        ...extraEnv,
      },
    })

  git("init", "-q", "-b", "main")
  const forkPoint = commit(UNRELEASED, "base")

  it("fails when main was promoted after the branch was cut", () => {
    git("checkout", "-q", "-b", "feat/tags", forkPoint)
    commit(addEntryUnderFirstAdded(UNRELEASED), "feat: tags")
    git("checkout", "-q", "main")
    const promoted = commit(PROMOTED, "chore: promote changelog for v26.10.8")
    const merged = git("merge-tree", "--write-tree", promoted, "feat/tags")

    // The line lands under 26.10.8 with no conflict, as in the incident.
    const changelog = git("show", `${merged}:CHANGELOG.md`)
    assert.ok(changelog.indexOf(NEW_ENTRY) > changelog.indexOf("## [26.10.8]"))

    const result = runCheck(promoted, merged)
    assert.equal(result.status, 1, result.stdout)
    assert.match(result.stdout, /Tags: projects can be filtered by tag/)
  })

  it("passes when the entry goes under [Unreleased] on the promoted main", () => {
    const promoted = git("rev-parse", "main")
    git("checkout", "-q", "-b", "feat/tags-rebased", promoted)
    commit(addEntryUnderUnreleased(PROMOTED), "feat: tags")
    const merged = git("merge-tree", "--write-tree", promoted, "feat/tags-rebased")

    const result = runCheck(promoted, merged)
    assert.equal(result.status, 0, result.stdout)
  })

  it("passes when a PR moves a misplaced entry back to [Unreleased]", () => {
    const misplaced = PROMOTED.replace(
      "- Search: results can be sorted by date.\n",
      `- Search: results can be sorted by date.\n${NEW_ENTRY}\n`,
    )
    const base = commit(misplaced, "the incident")
    const fixed = commit(addEntryUnderUnreleased(PROMOTED), "fix: move the entry")

    assert.equal(runCheck(base, fixed).status, 0)
  })

  it("passes the release bot's promotion and fails the same change by a person", () => {
    git("checkout", "-q", "-b", "release", forkPoint)
    const base = git("rev-parse", "HEAD")
    const promotion = commit(PROMOTED, "chore: promote changelog for v26.10.8")
    const bot = { HEAD_REF: "chore/changelog-v26.10.8", PR_AUTHOR: "github-actions[bot]" }

    assert.equal(runCheck(base, promotion, bot).status, 0)
    assert.equal(runCheck(base, promotion, { HEAD_REF: "chore/x", PR_AUTHOR: "someone" }).status, 1)
  })
})

describe("releasedAdditions", () => {
  it("ignores blank lines below the first released heading", () => {
    const diff = "@@ -13,0 +14 @@\n+"
    assert.deepEqual(releasedAdditions({ diff, changelog: PROMOTED }), [])
  })
})
