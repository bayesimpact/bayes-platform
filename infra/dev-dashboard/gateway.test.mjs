import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { daemonTarget, gatewayDecision } from "./gateway.mjs"

const DASHBOARD = "http://dev.connect.localhost:8800"
const TOKEN = `1001.${"a".repeat(43)}`

describe("gatewayDecision", () => {
  it("forwards the dashboard's requests and those of local clients, to the uid of the token", () => {
    assert.deepEqual(
      gatewayDecision({
        method: "POST",
        origin: DASHBOARD,
        token: TOKEN,
        dashboardOrigin: DASHBOARD,
      }),
      {
        uid: 1001,
      },
    )
    assert.deepEqual(gatewayDecision({ method: "GET", token: TOKEN, dashboardOrigin: DASHBOARD }), {
      uid: 1001,
    })
  })

  it("refuses preflights and other origins, worktree apps included", () => {
    assert.equal(
      gatewayDecision({
        method: "OPTIONS",
        origin: DASHBOARD,
        token: TOKEN,
        dashboardOrigin: DASHBOARD,
      }).status,
      403,
    )
    for (const origin of [
      "http://fix-sidebar.connect.localhost:8800",
      "https://example.com",
      "null",
    ]) {
      assert.equal(
        gatewayDecision({ method: "POST", origin, token: TOKEN, dashboardOrigin: DASHBOARD })
          .status,
        403,
      )
    }
  })

  it("asks for a token", () => {
    assert.equal(
      gatewayDecision({ method: "POST", origin: DASHBOARD, dashboardOrigin: DASHBOARD }).status,
      401,
    )
    assert.equal(
      gatewayDecision({ method: "POST", token: "1001.short", dashboardOrigin: DASHBOARD }).status,
      401,
    )
  })
})

describe("daemonTarget", () => {
  const directory = mkdtempSync(join(tmpdir(), "daemons-"))
  writeFileSync(join(directory, "1001.json"), JSON.stringify({ uid: 1001, socket: "1001.sock" }))
  writeFileSync(join(directory, "1001.sock"), "")
  writeFileSync(join(directory, "501.json"), JSON.stringify({ uid: 501, port: 49152 }))
  writeFileSync(join(directory, "1002.json"), JSON.stringify({ uid: 1001, port: 49153 }))
  const owners = (map) => (path) => map[path.split("/").pop()] ?? 0

  it("reaches a socket on Linux and a port on a Mac", () => {
    const owner = owners({ "1001.json": 1001, "1001.sock": 1001 })
    assert.deepEqual(daemonTarget(directory, 1001, owner), {
      socketPath: join(directory, "1001.sock"),
    })
    assert.deepEqual(daemonTarget(directory, 501, owner), {
      host: "host.docker.internal",
      port: 49152,
    })
  })

  it("ignores a description a colleague wrote for someone else", () => {
    assert.equal(
      daemonTarget(directory, 1001, owners({ "1001.json": 1002, "1001.sock": 1001 })),
      null,
    )
    assert.equal(
      daemonTarget(directory, 1001, owners({ "1001.json": 1001, "1001.sock": 1002 })),
      null,
    )
    assert.equal(daemonTarget(directory, 1002, owners({ "1002.json": 1002 })), null)
    assert.equal(daemonTarget(directory, 7, owners({})), null)
  })
})
