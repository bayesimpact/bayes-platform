import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  daemonDescription,
  jobCommand,
  loginUrl,
  matchRoute,
  parseToken,
  sameToken,
  validSelection,
  validService,
} from "./daemon.mjs"

const SECRET = "a".repeat(43)

describe("parseToken", () => {
  it("reads the uid and the secret", () => {
    assert.deepEqual(parseToken(`501.${SECRET}`), { uid: 501, secret: SECRET })
  })

  it("refuses a short secret, a missing uid or something else than a string", () => {
    assert.equal(parseToken("501.short"), null)
    assert.equal(parseToken(`.${SECRET}`), null)
    assert.equal(parseToken(`alice.${SECRET}`), null)
    assert.equal(parseToken(undefined), null)
  })
})

describe("sameToken", () => {
  it("accepts the same token only", () => {
    assert.equal(sameToken(`501.${SECRET}`, `501.${SECRET}`), true)
    assert.equal(sameToken(`501.${SECRET}b`, `501.${SECRET}`), false)
    assert.equal(sameToken(undefined, `501.${SECRET}`), false)
  })
})

describe("matchRoute", () => {
  it("routes the reads and the jobs", () => {
    assert.deepEqual(matchRoute("GET", "/api/me"), { route: "me" })
    assert.deepEqual(matchRoute("GET", "/api/status"), { route: "status" })
    assert.deepEqual(matchRoute("GET", "/api/jobs"), { route: "jobs" })
    const id = "0b5c2f4e-9d0a-4c47-9a39-6f4d1f0b7c11"
    assert.deepEqual(matchRoute("GET", `/api/jobs/${id}`), { route: "job", id })
    assert.deepEqual(matchRoute("POST", "/api/worktrees"), { route: "new" })
  })

  it("routes the actions on an environment", () => {
    assert.deepEqual(matchRoute("POST", "/api/environments/fix-sidebar/stop"), {
      route: "compose",
      slug: "fix-sidebar",
      action: "stop",
    })
    assert.deepEqual(matchRoute("POST", "/api/environments/135/reset-db"), {
      route: "job-action",
      slug: "135",
      action: "reset-db",
    })
    assert.deepEqual(matchRoute("GET", "/api/environments/135/logs"), {
      route: "logs",
      slug: "135",
    })
    assert.deepEqual(matchRoute("POST", "/api/environments/135/open"), {
      route: "open",
      slug: "135",
    })
    assert.deepEqual(matchRoute("POST", "/api/environments/135/describe"), {
      route: "describe",
      slug: "135",
    })
  })

  it("refuses a bad name, a wrong method or an unknown action", () => {
    assert.equal(matchRoute("POST", "/api/environments/..%2Fetc/up"), null)
    assert.equal(matchRoute("POST", "/api/environments/Fix_Sidebar/up"), null)
    assert.equal(matchRoute("GET", "/api/environments/fix-sidebar/stop"), null)
    assert.equal(matchRoute("POST", "/api/environments/fix-sidebar/rm"), null)
    assert.equal(matchRoute("POST", "/api/environments/fix-sidebar/up/more"), null)
    assert.equal(matchRoute("GET", "/api/jobs/not-an-id"), null)
    assert.equal(matchRoute("GET", "/state"), null)
  })
})

describe("validService", () => {
  it("accepts a compose service name only", () => {
    assert.equal(validService("storybook-web"), "storybook-web")
    assert.equal(validService("--volumes"), null)
    assert.equal(validService("api web"), null)
    assert.equal(validService(undefined), null)
  })
})

describe("jobCommand", () => {
  const mainCheckout = "/home/alice/bayes-platform"
  const path = `${mainCheckout}/.claude/worktrees/fix-sidebar`

  it("runs the worktree's own wt.mjs for its environment", () => {
    assert.deepEqual(
      jobCommand({ action: "up", slug: "fix-sidebar", path, worktreeExists: true, mainCheckout }),
      {
        script: `${path}/infra/worktree/wt.mjs`,
        cwd: path,
        args: ["up"],
      },
    )
  })

  it("runs the main checkout's for new and cleanup", () => {
    assert.deepEqual(jobCommand({ action: "new", name: "135", mainCheckout }).args, ["new", "135"])
    assert.deepEqual(
      jobCommand({
        action: "new",
        name: "fix-sidebar",
        description: "Fix the sidebar",
        mainCheckout,
      }).args,
      ["new", "fix-sidebar", "--description", "Fix the sidebar"],
    )
    assert.deepEqual(
      jobCommand({
        action: "cleanup",
        slug: "fix-sidebar",
        path,
        worktreeExists: true,
        mainCheckout,
      }),
      {
        script: `${mainCheckout}/infra/worktree/wt.mjs`,
        cwd: mainCheckout,
        args: ["cleanup", "--apply", "--slug", "fix-sidebar"],
      },
    )
  })

  it("removes the environment of a gone worktree from the main checkout, and nothing else", () => {
    const gone = { slug: "fix-sidebar", path, worktreeExists: false, mainCheckout }
    assert.deepEqual(jobCommand({ ...gone, action: "down" }).args, [
      "down",
      "--slug",
      "fix-sidebar",
    ])
    assert.throws(() => jobCommand({ ...gone, action: "up" }), /gone/u)
  })
})

describe("daemonDescription and loginUrl", () => {
  it("names a socket on Linux and a port on a Mac", () => {
    assert.deepEqual(
      daemonDescription({ uid: 1001, user: "alice", platform: "linux", port: 4000 }),
      {
        uid: 1001,
        user: "alice",
        socket: "1001.sock",
      },
    )
    assert.deepEqual(daemonDescription({ uid: 501, user: "bob", platform: "darwin", port: 4000 }), {
      uid: 501,
      user: "bob",
      port: 4000,
    })
  })

  it("puts the token in the fragment", () => {
    assert.equal(
      loginUrl("http://dev.connect.localhost:8800", `501.${SECRET}`),
      `http://dev.connect.localhost:8800/#token=501.${SECRET}`,
    )
  })
})

describe("promote and restore points", () => {
  const mainCheckout = "/home/alice/bayes-platform"

  it("routes the diff, the copy and the restore points", () => {
    assert.deepEqual(matchRoute("GET", "/api/environments/fix-sidebar/promote"), {
      route: "promote-diff",
      slug: "fix-sidebar",
    })
    assert.deepEqual(matchRoute("POST", "/api/environments/fix-sidebar/promote"), {
      route: "promote",
      slug: "fix-sidebar",
    })
    assert.deepEqual(matchRoute("GET", "/api/restore-points"), { route: "restore-points" })
    assert.deepEqual(matchRoute("POST", "/api/restore-points/2026-10-14T10-20-11-322Z/restore"), {
      route: "restore",
      id: "2026-10-14T10-20-11-322Z",
    })
    assert.equal(matchRoute("POST", "/api/restore-points/..%2F..%2Fetc/restore"), null)
    assert.equal(matchRoute("DELETE", "/api/environments/fix-sidebar/promote"), null)
  })

  it("runs the main checkout's wt.mjs for both", () => {
    assert.deepEqual(
      jobCommand({ action: "promote-diff", slug: "fix-sidebar", mainCheckout }).args,
      ["promote", "--slug", "fix-sidebar", "--json"],
    )
    assert.deepEqual(
      jobCommand({
        action: "promote",
        slug: "fix-sidebar",
        selection: "/tmp/s.json",
        mainCheckout,
      }),
      {
        script: `${mainCheckout}/infra/worktree/wt.mjs`,
        cwd: mainCheckout,
        args: ["promote", "--slug", "fix-sidebar", "--apply", "--selection", "/tmp/s.json"],
      },
    )
    assert.deepEqual(
      jobCommand({ action: "restore", restorePoint: "2026-10-14T10-20-11-322Z", mainCheckout })
        .args,
      ["restore-main", "2026-10-14T10-20-11-322Z"],
    )
  })

  it("accepts a selection of row keys only", () => {
    const keys = ['app_manifest:["745abe2d-94e1-46c6-9b45-e90c73c66612"]']
    assert.deepEqual(validSelection(keys), keys)
    assert.equal(validSelection([]), null)
    assert.equal(validSelection("app_manifest"), null)
    assert.equal(validSelection(["--all"]), null)
    assert.equal(validSelection([42]), null)
  })
})
