// ~/.bayes-worktrees/status.json: what the dashboard shows next to the containers (branch,
// pull request, databases, cleanup verdict), one entry per environment.
import { join } from "node:path"
import { STATE_DIR } from "../../dex/dex-config.mjs"
import { readJson, run, writeFileAtomic } from "./system.mjs"

export const STATUS_FILE = join(STATE_DIR, "status.json")

export function readStatus() {
  return readJson(STATUS_FILE, { environments: {} })
}

/** Merges `details` into the entry of `slug`, or removes the entry when `details` is null. */
export function updateStatus(slug, details) {
  const status = readStatus()
  status.environments ??= {}
  if (details === null) delete status.environments[slug]
  else status.environments[slug] = { ...status.environments[slug], ...details }
  status.updatedAt = new Date().toISOString()
  writeFileAtomic(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`)
}

/** The current branch of a checkout, or null on a detached HEAD. */
export function currentBranch(cwd) {
  return run("git", ["branch", "--show-current"], { cwd }) || null
}

/**
 * The latest pull request of a branch, through gh. Null when gh is missing, signed out or
 * offline, or when the branch has none.
 */
export function pullRequestOf(branch, cwd) {
  if (!branch) return null
  try {
    const [pr] = JSON.parse(
      run(
        "gh",
        [
          "pr",
          "list",
          "--head",
          branch,
          "--state",
          "all",
          "--limit",
          "1",
          "--json",
          "number,state,url,title,headRefOid,mergedAt,closedAt",
        ],
        { cwd },
      ),
    )
    return pr ?? null
  } catch {
    return null
  }
}
