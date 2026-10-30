/**
 * Gate on the public chat API contract. Rules: docs/public-api-contract.md.
 *
 * Fails the PR when contract files or the public documentation change without the
 * `public-contract-approved` label set by a maintainer who is not the PR author, when
 * the contract sources of a major change without a bump of that major's version
 * constant, or when the documentation does not carry the version of the newest major.
 *
 * Inputs (env): BASE_SHA, HEAD_SHA (the pull request head; default: working tree),
 * BASE_REF (base branch name, so the diff follows the current tip), PR_LABELS
 * (comma-separated), PR_NUMBER, PR_AUTHOR, GH_REPO, GH_TOKEN.
 * Set SKIP_ACTOR_CHECK=1 for a local dry run.
 *
 * On a pull_request, github.sha is a merge into the latest base, while
 * pull_request.base.sha can stay at the commit from when the PR opened. Diffing
 * those two includes files that already landed on the base. The gate diffs the
 * PR head against the merge base with the current base branch instead.
 *
 * Local dry run (HEAD_SHA unset: the working tree is compared, untracked files included):
 *   BASE_SHA=$(git merge-base origin/main HEAD) PR_LABELS="" node .github/scripts/public-contract-check.mjs
 */
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, readFileSync } from "node:fs"

const LABEL = "public-contract-approved"
const MAINTAINERS = ["jdoucy", "alexisjamet", "did", "OlivierDoucy"]
const RULE = "docs/public-api-contract.md"

const CONTRACTS_DIR = "packages/api-contracts/src/public-chat"

/**
 * One entry per served major, oldest first. Each bumps its own version constant. The help
 * pages document the newest major, the last entry.
 */
const MAJORS = [1, 2].map((major) => ({
  constant: `PUBLIC_API_V${major}_VERSION`,
  versionFile: `${CONTRACTS_DIR}/v${major}/public-chat-v${major}.version.ts`,
  paths: [`${CONTRACTS_DIR}/v${major}/`],
}))
const DOCUMENTED_MAJOR = MAJORS.at(-1)

/** Shared by every major (path prefix, helper types): a change here is a change to each. */
const SHARED_VERSION_PATHS = [`${CONTRACTS_DIR}/public-chat.`]

/** Any change here needs the label. A new major (`v3/`) needs its own entry here and in CODEOWNERS. */
const LABEL_PATHS = [
  "packages/api-contracts/src/public-chat/",
  "apps/api/src/domains/public-chat/v1/",
  "apps/api/src/domains/public-chat/v2/",
  "apps/api/src/domains/public-chat/guards/",
  "apps/api/src/config/cors.ts",
  "apps/help/src/content/docs/en/public-chat-api",
  "apps/help/src/content/docs/fr/public-chat-api",
  "docs/public-api-contract.md",
  "docs/public-chat-api.md",
]

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
// Fork point of the PR head and the current base. Files changed only on the base
// after that point are not changes by this pull request.
const diffBase = resolveDiffBase(baseSha, headSha)
const labels = (process.env.PR_LABELS ?? "")
  .split(",")
  .map((label) => label.trim())
  .filter(Boolean)
const failures = []
const notes = []

// Without HEAD_SHA (local dry run) the working tree is compared, untracked files included.
const changedFiles = [
  ...(process.env.HEAD_SHA
    ? git("diff", "--name-only", diffBase, headSha)
    : git("diff", "--name-only", baseSha) + git("ls-files", "--others", "--exclude-standard")
  ).split("\n"),
]
  .map((file) => file.trim())
  .filter(Boolean)
const touches = (prefixes) =>
  changedFiles.filter((file) => prefixes.some((prefix) => file.startsWith(prefix)))

const labelPathsTouched = touches(LABEL_PATHS)

for (const major of MAJORS) {
  major.headVersion = existsSync(major.versionFile)
    ? readVersion(readFileSync(major.versionFile, "utf8"), major.constant)
    : null
  major.baseVersion = readVersion(gitShowOrNull(`${diffBase}:${major.versionFile}`), major.constant)
  // Version bump is judged on the PR head, not the merge commit. A bump that
  // already landed on the base must not satisfy a pull request that did not bump.
  major.prHeadVersion = process.env.HEAD_SHA
    ? readVersion(gitShowOrNull(`${headSha}:${major.versionFile}`), major.constant)
    : major.headVersion
  if (!major.headVersion) failures.push(`${major.versionFile} does not define ${major.constant}.`)
}
const headVersion = DOCUMENTED_MAJOR.headVersion

// Always on: the published documentation must carry the version of the newest major.
for (const page of DOC_PAGES) {
  if (!existsSync(page)) {
    failures.push(`${page} is missing. The public documentation is part of the contract.`)
    continue
  }
  const docVersion = readFrontmatterVersion(readFileSync(page, "utf8"))
  if (docVersion !== headVersion) {
    failures.push(
      `${page}: apiVersion is ${docVersion ?? "missing"}, ${DOCUMENTED_MAJOR.constant} is ${headVersion}.`,
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
  for (const major of MAJORS) {
    const majorPathsTouched = touches([...major.paths, ...SHARED_VERSION_PATHS])
    if (majorPathsTouched.length > 0) checkVersionBump(major, majorPathsTouched)
  }
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

function checkVersionBump(major, majorPathsTouched) {
  const { constant, versionFile, baseVersion, prHeadVersion } = major
  notes.push(
    `Contract sources of ${constant} changed:\n${majorPathsTouched.map((file) => `- ${file}`).join("\n")}`,
  )
  if (prHeadVersion && prHeadVersion === baseVersion) {
    failures.push(
      `The contract sources changed but ${constant} is still ${prHeadVersion}. Bump it in ${versionFile}.`,
    )
  } else {
    notes.push(`${constant}: ${baseVersion ?? "none"} -> ${prHeadVersion}.`)
  }
  for (const page of CHANGELOG_PAGES) {
    const source = readRevisionFile(headSha, page)
    if (!source) continue
    const heading = new RegExp(`^## ${escapeRegex(prHeadVersion ?? "")} \\(`, "m")
    if (!heading.test(source)) {
      failures.push(`${page} has no "## ${prHeadVersion} (<date>)" entry for this version.`)
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

function resolveDiffBase(baseSha, headSha) {
  if (!process.env.HEAD_SHA) return baseSha
  const baseRef = process.env.BASE_REF?.trim()
  const left = baseRef ? (baseRef.startsWith("origin/") ? baseRef : `origin/${baseRef}`) : baseSha
  return git("merge-base", left, headSha).trim()
}

function readRevisionFile(revision, filePath) {
  if (!process.env.HEAD_SHA) return existsSync(filePath) ? readFileSync(filePath, "utf8") : null
  return gitShowOrNull(`${revision}:${filePath}`)
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

function readVersion(source, constant) {
  const pattern = new RegExp(`${constant}\\s*=\\s*"(\\d+\\.\\d+)"`)
  return source?.match(pattern)?.[1] ?? null
}

function readFrontmatterVersion(source) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ""
  return frontmatter.match(/^apiVersion:\s*"?(\d+\.\d+)"?\s*$/m)?.[1] ?? null
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
