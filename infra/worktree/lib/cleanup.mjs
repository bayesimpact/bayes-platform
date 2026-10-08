// What to do with a worktree and its environment once its pull request is merged or closed.
// The rule: remove only what can be rebuilt. A worktree with uncommitted changes, commits that
// the pull request does not have, or someone working in it, is always kept. Pure functions only.

export const MAX_REMOVALS_PER_RUN = 3
const MERGE_GRACE_MS = 30 * 60 * 1000
const ACTIVITY_GRACE_MS = 2 * 60 * 60 * 1000

/**
 * `remove`: tear the environment down, then remove the worktree and its branch.
 * `teardown`: the worktree is already gone, tear its environment down.
 * `keep`: nothing to do, with the reason shown on the dashboard.
 */
export function decide(facts) {
  if (facts.isAgentWorktree) return keep("agent worktree")
  if (!facts.worktreeExists) {
    return facts.hasEnvironment ? { action: "teardown", reason: "worktree removed" } : keep("gone")
  }
  if (facts.locked) return keep("worktree locked")
  if (!facts.branch) return keep("detached HEAD")
  if (!facts.ghAvailable) return keep("gh unavailable")
  if (!facts.pr) return keep("no pull request")
  if (facts.pr.state === "OPEN") return keep(`pull request #${facts.pr.number} open`)
  if (facts.dirty) return keep("uncommitted changes")
  if (!facts.headInPullRequest) return keep("commits that are not in the pull request")
  if (facts.inUse) return keep("in use")
  const endedAt = Date.parse(facts.pr.mergedAt ?? facts.pr.closedAt ?? "")
  if (Number.isFinite(endedAt) && facts.now - endedAt < MERGE_GRACE_MS) {
    return keep(`pull request #${facts.pr.number} ${facts.pr.state.toLowerCase()} minutes ago`)
  }
  if (facts.lastActivityAt && facts.now - facts.lastActivityAt < ACTIVITY_GRACE_MS) {
    return keep("active in the last 2 hours")
  }
  return {
    action: "remove",
    reason: `pull request #${facts.pr.number} ${facts.pr.state.toLowerCase()}`,
  }
}

function keep(reason) {
  return { action: "keep", reason }
}

/** Entries of `git worktree list --porcelain`. */
export function parseWorktreeList(text) {
  const entries = []
  for (const block of text.trim().split(/\n\n+/u)) {
    const entry = { path: null, head: null, branch: null, locked: false, prunable: false }
    for (const line of block.split("\n")) {
      const [key, ...rest] = line.split(" ")
      const value = rest.join(" ")
      if (key === "worktree") entry.path = value
      else if (key === "HEAD") entry.head = value
      else if (key === "branch") entry.branch = value.replace(/^refs\/heads\//u, "")
      else if (key === "locked") entry.locked = true
      else if (key === "prunable") entry.prunable = true
    }
    if (entry.path) entries.push(entry)
  }
  return entries
}
