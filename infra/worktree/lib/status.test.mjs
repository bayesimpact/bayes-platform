import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

// Each writer updates its own entry, as `wt up` of one environment does while the cleanup of a
// session start updates another.
const WRITER = `
const { updateStatus } = await import(process.argv[1])
for (let round = 1; round <= 25; round += 1) updateStatus(process.argv[2], { round })
`

function runWriter(home, slug) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--input-type=module", "-e", WRITER, new URL("./status.mjs", import.meta.url).href, slug],
      { env: { ...process.env, BAYES_DEV_HOME: home }, stdio: "inherit" },
    )
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${slug}: ${code}`))))
  })
}

describe("updateStatus", () => {
  it("keeps every environment's entry when several processes write at once", async () => {
    const home = mkdtempSync(join(tmpdir(), "wt-status-"))
    try {
      const slugs = ["a", "b", "c", "d", "e", "f"]
      await Promise.all(slugs.map((slug) => runWriter(home, slug)))
      const status = JSON.parse(readFileSync(join(home, "status.json"), "utf8"))
      for (const slug of slugs) assert.equal(status.environments[slug]?.round, 25, slug)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
