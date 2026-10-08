import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, describe, it } from "node:test"

// STATE_DIR is read when the module loads.
const home = mkdtempSync(join(tmpdir(), "wt-locks-"))
process.env.BAYES_DEV_HOME = home
const { withLockIfFree, withLockSync } = await import("./system.mjs")
const locks = join(home, "locks")
after(() => rmSync(home, { recursive: true, force: true }))

function leaveLock(name, holder) {
  mkdirSync(locks, { recursive: true })
  writeFileSync(join(locks, `${name}.lock`), JSON.stringify(holder))
}

describe("withLockSync", () => {
  it("removes its lock when done", () => {
    assert.equal(
      withLockSync("own", () => "done"),
      "done",
    )
    assert.ok(!existsSync(join(locks, "own.lock")))
  })

  it("takes over a lock whose process is gone", () => {
    leaveLock("gone", { pid: 99_999_999, startedAt: new Date().toISOString() })
    assert.equal(
      withLockSync("gone", () => "in"),
      "in",
    )
  })

  it("takes over a lock taken before the machine started, even if its pid is alive again", () => {
    leaveLock("before-boot", { pid: process.pid, startedAt: "2000-01-01T00:00:00.000Z" })
    assert.equal(
      withLockSync("before-boot", () => "in"),
      "in",
    )
  })

  it("takes over a machine-wide lock held longer than its work can take", () => {
    const startedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    leaveLock("_shared", { pid: process.pid, startedAt })
    assert.equal(
      withLockSync("_shared", () => "in"),
      "in",
    )
  })

  it("leaves the lock to a process that took it over meanwhile", () => {
    withLockSync("taken-over", () => {
      leaveLock("taken-over", { pid: process.pid, startedAt: "another holder" })
    })
    assert.ok(existsSync(join(locks, "taken-over.lock")))
  })
})

describe("withLockIfFree", () => {
  it("runs the work when nobody holds the lock", async () => {
    assert.deepEqual(await withLockIfFree("free", async () => "removed"), { result: "removed" })
    assert.ok(!existsSync(join(locks, "free.lock")))
  })

  it("says who holds the lock instead of waiting", async () => {
    leaveLock("busy", { pid: process.pid, startedAt: new Date().toISOString() })
    let ran = false
    const outcome = await withLockIfFree("busy", async () => {
      ran = true
    })
    assert.deepEqual(outcome, { busy: process.pid })
    assert.equal(ran, false)
    assert.ok(existsSync(join(locks, "busy.lock")))
  })
})
