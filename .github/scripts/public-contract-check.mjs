/**
 * Gate on the public chat API contract. Rules: docs/public-api-contract.md.
 *
 * Fails the PR when contract files or the public documentation change without the
 * `public-contract-approved` label set by a maintainer who is not the PR author, when
 * the contract sources change without a `PUBLIC_API_VERSION` bump, or when the
 * documentation does not carry the current version.
 *
 * Inputs (env): BASE_SHA, HEAD_SHA (default HEAD), PR_LABELS (comma-separated),
 * PR_NUMBER, PR_AUTHOR, GH_REPO, GH_TOKEN. Set SKIP_ACTOR_CHECK=1 for a local dry run.
 *
 * Local dry run (HEAD_SHA unset: the working tree is compared, untracked files included):
 *   BASE_SHA=$(git merge-base origin/main HEAD) PR_LABELS="" node .github/scripts/public-contract-check.mjs
 */
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, readFileSync } from "node:fs"

const LABEL = "public-contract-approved"
const MAINTAINERS = ["jdoucy", "alexisjamet", "did", "OlivierDoucy"]
const RULE = "docs/public-api-contract.md"

const VERSION_FILE = "packages/api-contracts/src/public-chat/public-chat.version.ts"
const VERSION_PATTERN = /PUBLIC_API_VERSION\s*=\s*"(\d+\.\d+)"/

/** Any change here needs the label. A new major (`v2/`) needs its own entry here and in CODEOWNERS. */
const LABEL_PATHS = [
  "packages/api-contracts/src/public-chat/",
  "apps/api/src/domains/public-chat/v1/",
  "apps/api/src/domains/public-chat/legacy/",
  "apps/api/src/domains/public-chat/public-chat.controller.ts",
  "apps/api/src/domains/public-chat/guards/",
  "apps/api/src/config/cors.ts",
  "apps/help/src/content/docs/en/public-chat-api",
  "apps/help/src/content/docs/fr/public-chat-api",
  "docs/public-api-contract.md",
  "docs/public-chat-api.md",
]

/** A change here is a contract change: it also needs a version bump and a changelog entry. */
const VERSION_PATHS = ["packages/api-contracts/src/public-chat/"]

const DOC_PAGES = [
  "public-chat-api",
  "public-chat-api-versioning",
  "public-chat-api-changelog",
].flatMap((slug) =>
  ["en", "fr"].map((locale) => `apps/help/src/content/docs/${locale}/${slug}.mdx`),
)
const CHANGELOG_PAGES = DOC_PAGES.filter((page) => page.endsWith("public-chat-api-changelog.mdx"))

const baseSha = requireEnv("BASE_SHA")
const headSha = process.env.HEAD_SHA || "HEAD"
const labels = (process.env.PR_LABELS ?? "")
  .split(",")
  .map((label) => label.trim())
  .filter(Boolean)
const failures = []
const notes = []

// Without HEAD_SHA (local dry run) the working tree is compared, untracked files included.
const changedFiles = [
  ...(process.env.HEAD_SHA
    ? git("diff", "--name-only", baseSha, headSha)
    : git("diff", "--name-only", baseSha) + git("ls-files", "--others", "--exclude-standard")
  ).split("\n"),
]
  .map((file) => file.trim())
  .filter(Boolean)
const touches = (prefixes) =>
  changedFiles.filter((file) => prefixes.some((prefix) => file.startsWith(prefix)))

const labelPathsTouched = touches(LABEL_PATHS)
const versionPathsTouched = touches(VERSION_PATHS)

const headVersion = existsSync(VERSION_FILE)
  ? readVersion(readFileSync(VERSION_FILE, "utf8"))
  : null
const baseVersion = readVersion(gitShowOrNull(`${baseSha}:${VERSION_FILE}`))
if (!headVersion) failures.push(`${VERSION_FILE} does not define PUBLIC_API_VERSION.`)

// Always on: the published documentation must carry the code version.
for (const page of DOC_PAGES) {
  if (!existsSync(page)) {
    failures.push(`${page} is missing. The public documentation is part of the contract.`)
    continue
  }
  const docVersion = readFrontmatterVersion(readFileSync(page, "utf8"))
  if (docVersion !== headVersion) {
    failures.push(
      `${page}: apiVersion is ${docVersion ?? "missing"}, PUBLIC_API_VERSION is ${headVersion}.`,
    )
  }
}

if (labelPathsTouched.length === 0) {
  notes.push("No public contract file changed in this PR.")
} else {
  notes.push(
    `Public contract files changed:\n${labelPathsTouched.map((file) => `- ${file}`).join("\n")}`,
  )
  checkLabel()
  if (versionPathsTouched.length > 0) checkVersionBump()
}

report()
process.exit(failures.length > 0 ? 1 : 0)

function checkLabel() {
  if (!labels.includes(LABEL)) {
    failures.push(
      `The PR changes the public contract and has no \`${LABEL}\` label. Ask a maintainer (${MAINTAINERS.map((login) => `@${login}`).join(", ")}) for a written go; they add the label.`,
    )
    return
  }
  if (process.env.SKIP_ACTOR_CHECK === "1") {
    notes.push("Label present. Actor check skipped (SKIP_ACTOR_CHECK=1).")
    return
  }
  const prNumber = process.env.PR_NUMBER
  const repo = process.env.GH_REPO
  if (!prNumber || !repo) {
    failures.push("Label present but PR_NUMBER or GH_REPO is unset, cannot verify who set it.")
    return
  }
  let events
  try {
    events = JSON.parse(
      execFileSync(
        "gh",
        ["api", `repos/${repo}/issues/${prNumber}/timeline`, "--paginate", "--slurp"],
        { encoding: "utf8" },
      ),
    ).flat()
  } catch (error) {
    failures.push(`Could not read the PR timeline to verify the label: ${error.message}`)
    return
  }
  const labelEvents = events.filter(
    (event) => event.event === "labeled" && event.label?.name === LABEL,
  )
  const lastLabelActor = labelEvents.at(-1)?.actor?.login
  const author = process.env.PR_AUTHOR
  if (!lastLabelActor || !MAINTAINERS.includes(lastLabelActor)) {
    failures.push(
      `\`${LABEL}\` was set by ${lastLabelActor ?? "an unknown actor"}, who is not a maintainer.`,
    )
  } else if (lastLabelActor === author) {
    failures.push(
      `\`${LABEL}\` was set by the PR author (${author}). Another maintainer must give the go.`,
    )
  } else {
    notes.push(`Label set by maintainer @${lastLabelActor}.`)
  }
}

function checkVersionBump() {
  notes.push(
    `Contract sources changed:\n${versionPathsTouched.map((file) => `- ${file}`).join("\n")}`,
  )
  if (headVersion && headVersion === baseVersion) {
    failures.push(
      `The contract sources changed but PUBLIC_API_VERSION is still ${headVersion}. Bump it in ${VERSION_FILE}.`,
    )
  } else {
    notes.push(`PUBLIC_API_VERSION: ${baseVersion ?? "none"} -> ${headVersion}.`)
  }
  for (const page of CHANGELOG_PAGES) {
    if (!existsSync(page)) continue
    const heading = new RegExp(`^## ${escapeRegex(headVersion ?? "")} \\(`, "m")
    if (!heading.test(readFileSync(page, "utf8"))) {
      failures.push(`${page} has no "## ${headVersion} (<date>)" entry for this version.`)
    }
  }
}

function report() {
  const lines = ["## Public API contract gate", ""]
  for (const note of notes) lines.push(note, "")
  if (failures.length === 0) {
    lines.push("Result: pass.")
  } else {
    lines.push("Result: fail.", "", ...failures.map((failure) => `- ${failure}`))
  }
  lines.push("", `Rules: ${RULE}`)
  const text = lines.join("\n")
  console.log(text)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`)
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`${name} is required.`)
    process.exit(2)
  }
  return value
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" })
}

function gitShowOrNull(ref) {
  try {
    return execFileSync("git", ["show", ref], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return null
  }
}

function readVersion(source) {
  return source?.match(VERSION_PATTERN)?.[1] ?? null
}

function readFrontmatterVersion(source) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ""
  return frontmatter.match(/^apiVersion:\s*"?(\d+\.\d+)"?\s*$/m)?.[1] ?? null
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
