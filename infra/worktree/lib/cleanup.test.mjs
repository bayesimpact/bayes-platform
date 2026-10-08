import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { decide, parseWorktreeList } from "./cleanup.mjs"

const now = Date.parse("2026-10-08T15:00:00Z")
const merged = {
  number: 951,
  state: "MERGED",
  headRefOid: "abc",
  mergedAt: "2026-10-08T10:00:00Z",
  closedAt: "2026-10-08T10:00:00Z",
}
const safe = {
  isAgentWorktree: false,
  worktreeExists: true,
  hasEnvironment: true,
  locked: false,
  branch: "fix/sidebar",
  ghAvailable: true,
  pr: merged,
  dirty: false,
  headInPullRequest: true,
  inUse: false,
  lastActivityAt: Date.parse("2026-10-08T09:00:00Z"),
  now,
}

describe("decide", () => {
  it("removes a clean, pushed, idle worktree whose pull request is merged", () => {
    assert.deepEqual(decide(safe), { action: "remove", reason: "pull request #951 merged" })
  })

  it("removes it the same way when the pull request was closed", () => {
    assert.equal(
      decide({ ...safe, pr: { ...merged, state: "CLOSED", mergedAt: null } }).action,
      "remove",
    )
  })

  it("tears the environment down when the worktree is gone", () => {
    assert.deepEqual(decide({ ...safe, worktreeExists: false, pr: null }), {
      action: "teardown",
      reason: "worktree removed",
    })
  })

  const kept = [
    ["an agent worktree", { isAgentWorktree: true }, "agent worktree"],
    ["a locked worktree", { locked: true }, "worktree locked"],
    ["a detached HEAD", { branch: null }, "detached HEAD"],
    ["without gh", { ghAvailable: false }, "gh unavailable"],
    ["without pull request", { pr: null }, "no pull request"],
    ["an open pull request", { pr: { ...merged, state: "OPEN" } }, "pull request #951 open"],
    ["uncommitted changes", { dirty: true }, "uncommitted changes"],
    [
      "commits after the pull request",
      { headInPullRequest: false },
      "commits that are not in the pull request",
    ],
    ["a worktree in use", { inUse: true }, "in use"],
    [
      "a pull request merged minutes ago",
      { pr: { ...merged, mergedAt: "2026-10-08T14:45:00Z" } },
      "pull request #951 merged minutes ago",
    ],
    [
      "recent git activity",
      { lastActivityAt: Date.parse("2026-10-08T14:00:00Z") },
      "active in the last 2 hours",
    ],
  ]
  for (const [label, override, reason] of kept) {
    it(`keeps ${label}`, () => {
      assert.deepEqual(decide({ ...safe, ...override }), { action: "keep", reason })
    })
  }

  it("checks the unsafe states before the age of the merge", () => {
    assert.equal(decide({ ...safe, dirty: true, inUse: true }).reason, "uncommitted changes")
  })
})

describe("parseWorktreeList", () => {
  it("reads paths, heads, branches and flags", () => {
    const text = [
      "worktree /repo",
      "HEAD 1111",
      "branch refs/heads/main",
      "",
      "worktree /repo/.claude/worktrees/fix-sidebar",
      "HEAD 2222",
      "branch refs/heads/fix/sidebar",
      "locked",
      "",
      "worktree /repo/.claude/worktrees/agent-a1",
      "HEAD 3333",
      "detached",
      "prunable gitdir file points to non-existent location",
      "",
    ].join("\n")
    assert.deepEqual(parseWorktreeList(text), [
      { path: "/repo", head: "1111", branch: "main", locked: false, prunable: false },
      {
        path: "/repo/.claude/worktrees/fix-sidebar",
        head: "2222",
        branch: "fix/sidebar",
        locked: true,
        prunable: false,
      },
      {
        path: "/repo/.claude/worktrees/agent-a1",
        head: "3333",
        branch: null,
        locked: false,
        prunable: true,
      },
    ])
  })
})
