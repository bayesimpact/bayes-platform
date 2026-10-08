import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { environmentNames, isDatabaseOf, nodeModulesFolders, slugProblem } from "./naming.mjs"

describe("slugProblem", () => {
  it("accepts lowercase names with single hyphens", () => {
    for (const slug of ["fix-sidebar", "a", "feat2-export-v2", "x".repeat(32)]) {
      assert.equal(slugProblem(slug), null, slug)
    }
  })

  it("refuses agent worktrees", () => {
    assert.match(slugProblem("agent-a1b2c3"), /agent worktrees/u)
  })

  it("refuses names that are not plain hostname labels", () => {
    for (const slug of ["Fix", "fix_sidebar", "fix--sidebar", "-fix", "fix-", "2fix", "fix.ui"]) {
      assert.match(slugProblem(slug), /lowercase letters/u, slug)
    }
  })

  it("refuses names longer than 32 characters", () => {
    assert.match(slugProblem("x".repeat(33)), /at most 32/u)
  })

  it("refuses the hostnames of the shared stack", () => {
    for (const slug of ["dev", "traefik", "phoenix", "mail", "grafana"]) {
      assert.match(slugProblem(slug), /shared stack/u, slug)
    }
  })

  it("refuses names that would take another environment's hostname", () => {
    for (const slug of [
      "fix-ui",
      "fix-embed",
      "fix-storybook",
      "fix-help",
      "fix-dex",
      "fix-grafana",
    ]) {
      assert.match(slugProblem(slug), /another environment's hostname/u, slug)
    }
  })
})

describe("environmentNames", () => {
  const names = environmentNames("fix-sidebar", 8800)

  it("derives the project, databases and Phoenix project", () => {
    assert.equal(names.project, "wt-fix-sidebar")
    assert.equal(names.database, "connect_wt_fix_sidebar")
    assert.equal(names.testDatabase, "connect_wt_fix_sidebar__test")
    assert.equal(names.phoenixProject, "wt-fix-sidebar")
  })

  it("derives the origins and the Dex issuer", () => {
    assert.equal(names.origin, "http://fix-sidebar.connect.localhost:8800")
    assert.equal(names.embedOrigin, "http://fix-sidebar-embed.connect.localhost:8800")
    assert.equal(names.dexIssuer, "http://fix-sidebar-dex.connect.localhost:8800/dex")
  })

  it("omits port 80", () => {
    assert.equal(environmentNames("fix", 80).origin, "http://fix.connect.localhost")
  })

  it("keeps every name within the limits of Postgres and DNS", () => {
    const longest = environmentNames("x".repeat(32), 8800)
    assert.ok(`${longest.testDatabase}_w999`.length <= 63)
    assert.ok(`${"x".repeat(32)}-embed-storybook`.length <= 63)
  })
})

describe("isDatabaseOf", () => {
  it("matches the databases of the environment", () => {
    for (const name of [
      "connect_wt_fix_sidebar",
      "connect_wt_fix_sidebar__test",
      "connect_wt_fix_sidebar__test_w3",
      "connect_wt_fix_sidebar__restoring",
    ]) {
      assert.ok(isDatabaseOf("fix-sidebar", name), name)
    }
  })

  it("never matches another environment's or the main checkout's databases", () => {
    for (const name of [
      "connect",
      "connect_test",
      "connect_test_w1",
      "connect_wt_fix",
      "connect_wt_fix_sidebar_v2",
      "connect_wt_fix_sidebar__test_wx",
    ]) {
      assert.ok(!isDatabaseOf("fix-sidebar", name), name)
    }
    assert.ok(!isDatabaseOf("fix", "connect_wt_fix_sidebar"))
  })
})

describe("nodeModulesFolders", () => {
  it("lists the root and every workspace with its own node_modules", () => {
    assert.deepEqual(
      nodeModulesFolders({
        packages: {
          "": {},
          "node_modules/react": {},
          "apps/api/node_modules/rxjs": {},
          "apps/api/node_modules/rxjs/node_modules/tslib": {},
          "packages/ui/node_modules/x": {},
          "apps/api": {},
        },
      }),
      ["", "apps/api", "packages/ui"],
    )
  })
})
