import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applySql,
  closure,
  compareRows,
  groupChanges,
  missingMigrations,
  rememberSkippedTables,
  restorePointId,
  rowKey,
  rowLabel,
  selectedByDefault,
  tableProblem,
  validRestorePointId,
} from "./promote.mjs"

const ID = "745abe2d-94e1-46c6-9b45-e90c73c66612"

describe("compareRows", () => {
  const main = new Map([
    ["a", 100],
    ["b", 100],
    ["c", 300],
    ["only-main", 1],
  ])
  const worktree = new Map([
    ["a", 100],
    ["b", 200],
    ["c", 200],
    ["new", 50],
  ])

  it("finds new rows, rows changed in the worktree and rows the main database changed too", () => {
    assert.deepEqual(compareRows({ main, worktree, ordered: true }), {
      added: ["new"],
      changed: ["b"],
      conflicts: ["c"],
    })
  })

  it("without updated_at, a different row is a change, and rows only in main stay", () => {
    assert.deepEqual(compareRows({ main, worktree, ordered: false }), {
      added: ["new"],
      changed: ["b", "c"],
      conflicts: [],
    })
  })
})

describe("missingMigrations and tableProblem", () => {
  it("lists the worktree's migrations the main database did not run", () => {
    assert.deepEqual(missingMigrations({ main: ["A", "B"], worktree: ["A", "B", "C"] }), ["C"])
  })

  it("refuses tables without key, with sequence ids, or with columns main lacks", () => {
    const table = (overrides) => ({ columns: ["id", "name"], primaryKey: ["id"], ...overrides })
    const check = (worktree, main = table()) =>
      tableProblem({
        table: "agent",
        worktreeSchema: { agent: worktree },
        mainSchema: { agent: main },
      })
    assert.equal(check(table()), null)
    assert.match(check(table({ primaryKey: [] })), /no primary key/u)
    assert.match(check(table({ generatedKey: true })), /collide/u)
    assert.match(check(table({ columns: ["id", "name", "color"] })), /lacks color/u)
    assert.match(
      tableProblem({
        table: "migrations",
        worktreeSchema: { migrations: table() },
        mainSchema: {},
      }),
      /TypeORM/u,
    )
  })
})

describe("rowLabel", () => {
  it("prefers a name, then the readable part of the key, then a short id", () => {
    assert.equal(rowLabel("app_manifest", { name: "Telegram", slug: "telegram" }, [ID]), "Telegram")
    assert.equal(rowLabel("role_permission", {}, [ID, "project.read"]), "project.read")
    assert.equal(rowLabel("activity", {}, [ID]), "745abe2d…")
  })
})

describe("selectedByDefault", () => {
  const now = Date.parse("2026-10-14T10:00:00Z")
  const skippedTables = new Set(["agent_message"])
  const added = (table, row = {}) => ({ kind: "added", table, row })

  it("selects new rows", () => {
    assert.equal(selectedByDefault(added("app_installation"), { now, skippedTables }), true)
  })

  it("leaves out changes, conflicts, revoked, consumed or expired rows and tables skipped before", () => {
    const leftOut = [
      { kind: "changed", table: "agent_settings", row: {} },
      { kind: "conflict", table: "agent_settings", row: {} },
      added("app_installation", { revoked_at: "2026-10-13T17:10:56Z" }),
      added("app_install_authorization_code", { consumed_at: "2026-10-13T17:10:56Z" }),
      added("invitation", { expires_at: "2026-10-01T00:00:00Z" }),
      added("agent_message"),
    ]
    for (const change of leftOut)
      assert.equal(selectedByDefault(change, { now, skippedTables }), false)
    assert.equal(
      selectedByDefault(added("invitation", { expires_at: "2026-11-01T00:00:00Z" }), {
        now,
        skippedTables,
      }),
      true,
    )
  })
})

describe("groupChanges", () => {
  const change = (table, label, named = true) => ({
    key: rowKey(table, [label]),
    table,
    label,
    named,
  })
  const manifest = change("app_manifest", "Telegram")
  const roles = [change("role", "App install telegram 1"), change("role", "App install telegram 2")]
  const installations = [
    change("app_installation", "1", false),
    change("app_installation", "2", false),
  ]
  const permission = change("role_permission", "project.read", false)
  const messages = [change("agent_message", "m1", false), change("agent_message", "m2", false)]
  const server = change("mcp_server", "PDF export")
  const requires = new Map([
    [installations[0].key, new Set([manifest.key, roles[0].key])],
    [installations[1].key, new Set([manifest.key, roles[1].key])],
    [permission.key, new Set([roles[0].key])],
  ])
  const groups = groupChanges(
    [...messages, permission, ...installations, server, ...roles, manifest],
    requires,
  )

  it("gathers what was made together, titled by what the rest depends on", () => {
    const [app] = groups
    assert.equal(app.title, "app_manifest Telegram")
    assert.equal(app.changes.length, 6)
    assert.equal(app.changes[0].key, manifest.key)
    assert.match(app.summary, /app_installation 2/u)
  })

  it("keeps a lone row alone, and gathers lone rows of a table, last", () => {
    assert.deepEqual(
      groups.map((group) => group.title),
      ["app_manifest Telegram", "mcp_server PDF export", "agent_message: 2 rows"],
    )
  })
})

describe("closure and rememberSkippedTables", () => {
  it("brings the rows a row requires, transitively", () => {
    const requires = new Map([
      ["installation", new Set(["manifest", "role"])],
      ["role", new Set(["organization"])],
    ])
    assert.deepEqual([...closure(["installation"], requires)].sort(), [
      "installation",
      "manifest",
      "organization",
      "role",
    ])
  })

  it("remembers the tables left out entirely, and forgets those picked again", () => {
    assert.deepEqual(
      rememberSkippedTables(["activity", "agent_message"], {
        offered: new Set(["activity", "agent_message", "document"]),
        selected: new Set(["agent_message"]),
      }),
      ["activity", "document"],
    )
  })
})

describe("applySql", () => {
  it("upserts each table in one transaction, foreign keys checked by the selection", () => {
    const sql = applySql(
      [
        {
          table: "user",
          columns: ["id", "name"],
          primaryKey: ["id"],
          rows: [{ id: ID, name: "it's" }],
        },
        {
          table: "role_permission",
          columns: ["role_id", "permission_key"],
          primaryKey: ["role_id", "permission_key"],
          rows: [{ role_id: ID, permission_key: "project.read" }],
        },
        { table: "empty", columns: ["id"], primaryKey: ["id"], rows: [] },
      ],
      "tag",
    )
    assert.match(sql, /^BEGIN;\nSET LOCAL session_replication_role = replica;/u)
    assert.match(
      sql,
      /INSERT INTO "user" \("id", "name"\) SELECT "id", "name" FROM json_populate_recordset\(NULL::"user", \$tag\$\[\{"id":"[^"]+","name":"it's"\}\]\$tag\$\) ON CONFLICT \("id"\) DO UPDATE SET \("name"\) = ROW\(EXCLUDED\."name"\);/u,
    )
    assert.match(sql, /ON CONFLICT \("role_id", "permission_key"\) DO NOTHING;/u)
    assert.doesNotMatch(sql, /"empty"/u)
    assert.match(sql, /COMMIT;$/u)
  })

  it("refuses rows that contain its quoting tag", () => {
    assert.throws(
      () =>
        applySql(
          [{ table: "user", columns: ["id"], primaryKey: ["id"], rows: [{ id: "$tag$" }] }],
          "tag",
        ),
      /quoting tag/u,
    )
  })
})

describe("restore point ids", () => {
  it("are dates usable in a file name, and nothing else", () => {
    const id = restorePointId(new Date("2026-10-14T10:20:11.322Z"))
    assert.equal(id, "2026-10-14T10-20-11-322Z")
    assert.equal(validRestorePointId(id), true)
    assert.equal(validRestorePointId("../../etc/passwd"), false)
  })
})
