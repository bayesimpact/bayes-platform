// Reads both databases for `wt promote`, applies a selection to the main one, and keeps restore
// points of the main database (`wt restore-main`). The decisions are in promote.mjs.
import { spawnSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { STATE_DIR } from "../../dex/dex-config.mjs"
import {
  applySql,
  closure,
  compareRows,
  groupChanges,
  IGNORED_TABLES,
  missingMigrations,
  quote,
  rememberSkippedTables,
  restorePointId,
  rowKey,
  rowLabel,
  selectedByDefault,
  tableProblem,
  validRestorePointId,
} from "./promote.mjs"
import { psql, readJson, writeFileAtomic } from "./system.mjs"

export const RESTORE_POINTS_DIR = join(STATE_DIR, "restore-points")
const PREFERENCES_FILE = join(STATE_DIR, "promote.json")
const RESTORE_POINT_DAYS = 14
// Columns read for the diff besides keys and labels: what tells a row's state at a glance.
const STATE_COLUMNS = ["status", "revoked_at", "consumed_at", "expires_at", "deleted_at"]
const LABEL_COLUMNS = ["name", "title", "label", "email", "slug", "key"]
const ROWS_PER_STATEMENT = 500

function queryJson(postgres, database, sql) {
  return JSON.parse(psql(postgres, database, sql) || "null")
}

/** Tables, columns, keys and foreign keys of a database, and the migrations it ran. */
export function readSchema(postgres, database) {
  const schema = queryJson(
    postgres,
    database,
    `SELECT json_build_object(
  'tables', (SELECT json_object_agg(c.relname, json_build_object(
    'columns', (SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''),
    'primaryKey', COALESCE((SELECT json_agg(a.attname ORDER BY k.ord) FROM pg_constraint p
      CROSS JOIN unnest(p.conkey) WITH ORDINALITY k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      WHERE p.conrelid = c.oid AND p.contype = 'p'), '[]'),
    'generatedKey', EXISTS (SELECT 1 FROM pg_constraint p CROSS JOIN unnest(p.conkey) k(attnum)
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE p.conrelid = c.oid AND p.contype = 'p'
        AND (a.attidentity <> '' OR pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval%'))))
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')),
  'foreignKeys', (SELECT COALESCE(json_agg(json_build_object(
    'table', source.relname,
    'columns', (SELECT json_agg(a.attname ORDER BY k.ord) FROM unnest(f.conkey) WITH ORDINALITY k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = f.conrelid AND a.attnum = k.attnum),
    'references', target.relname,
    'referencedColumns', (SELECT json_agg(a.attname ORDER BY k.ord) FROM unnest(f.confkey) WITH ORDINALITY k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = f.confrelid AND a.attnum = k.attnum))), '[]')
    FROM pg_constraint f JOIN pg_class source ON source.oid = f.conrelid
    JOIN pg_class target ON target.oid = f.confrelid
    WHERE f.contype = 'f' AND f.connamespace = 'public'::regnamespace)
);`,
  )
  const migrations = queryJson(
    postgres,
    database,
    "SELECT COALESCE(json_agg(name ORDER BY name), '[]') FROM migrations;",
  )
  return { ...schema, migrations }
}

/**
 * The version of every row of `tables`: its updated_at in microseconds when the table has one,
 * else a hash of the row, so that large rows (embeddings) are never read whole.
 */
function readVersions(postgres, database, schema, tables) {
  const parts = tables.map((table) => {
    const { primaryKey, columns } = schema.tables[table]
    const key = `json_build_array(${primaryKey.map((column) => `t.${quote(column)}`).join(", ")})`
    const version = columns.includes("updated_at")
      ? "COALESCE((extract(epoch FROM t.updated_at) * 1000000)::bigint, -1)"
      : "md5(row_to_json(t)::text)"
    return `'${table}', (SELECT COALESCE(json_agg(json_build_array(${key}, ${version})), '[]') FROM ${quote(table)} t)`
  })
  // json_build_object takes at most 100 arguments: 40 tables per query.
  const versions = {}
  for (let start = 0; start < parts.length; start += 40) {
    Object.assign(
      versions,
      queryJson(
        postgres,
        database,
        `SELECT json_build_object(${parts.slice(start, start + 40).join(",\n")});`,
      ),
    )
  }
  return versions
}

/** Some columns of the rows of `keysByTable` (table → primary keys), keyed by row key. */
function readRows(postgres, database, schema, keysByTable, pickColumns) {
  const parts = []
  for (const [table, keys] of keysByTable) {
    if (!keys.length) continue
    const { primaryKey, columns } = schema.tables[table]
    const picked = pickColumns(table, columns)
    const key = `json_build_array(${primaryKey.map((column) => `t.${quote(column)}`).join(", ")})`
    const row = picked
      ? `json_build_object(${picked.map((column) => `'${column}', t.${quote(column)}`).join(", ")})`
      : "row_to_json(t)"
    const tag = `k${randomBytes(6).toString("hex")}`
    parts.push(
      `'${table}', (SELECT COALESCE(json_agg(json_build_array(${key}, ${row})), '[]') FROM ${quote(table)} t
        WHERE ${key}::jsonb IN (SELECT value FROM jsonb_array_elements($${tag}$${JSON.stringify(keys)}$${tag}$::jsonb)))`,
    )
  }
  const rows = new Map()
  // A few tables per query keeps each answer within reach of psql and Node.
  for (let start = 0; start < parts.length; start += 8) {
    const answer = queryJson(
      postgres,
      database,
      `SELECT json_build_object(${parts.slice(start, start + 8).join(",\n")});`,
    )
    for (const [table, entries] of Object.entries(answer ?? {})) {
      for (const [primaryKey, row] of entries) rows.set(rowKey(table, primaryKey), row)
    }
  }
  return rows
}

/** Foreign keys whose referenced columns are the referenced table's primary key. */
function usableForeignKeys(schema) {
  return schema.foreignKeys
    .map((foreignKey) => {
      const target = schema.tables[foreignKey.references]
      if (!target || !schema.tables[foreignKey.table]) return null
      // The columns of the row, in the order of the target's primary key.
      const order = target.primaryKey.map((column) => foreignKey.referencedColumns.indexOf(column))
      if (order.includes(-1) || order.length !== foreignKey.referencedColumns.length) return null
      return { ...foreignKey, columns: order.map((index) => foreignKey.columns[index]) }
    })
    .filter(Boolean)
}

/**
 * Everything the worktree changed that the main database does not have, in groups, with what
 * each row requires and whether it starts selected.
 */
export function readPromotion({ postgres, mainDatabase, worktreeDatabase, now = Date.now() }) {
  const worktreeSchema = readSchema(postgres, worktreeDatabase)
  const mainSchema = readSchema(postgres, mainDatabase)
  const migrations = missingMigrations({
    main: mainSchema.migrations ?? [],
    worktree: worktreeSchema.migrations ?? [],
  })
  const tables = Object.keys(worktreeSchema.tables)
    .filter((table) => !IGNORED_TABLES.has(table) && worktreeSchema.tables[table].primaryKey.length)
    .sort()
  const sharedTables = tables.filter((table) => mainSchema.tables[table])
  const worktreeVersions = readVersions(postgres, worktreeDatabase, worktreeSchema, tables)
  const mainVersions = readVersions(postgres, mainDatabase, mainSchema, sharedTables)

  const changes = []
  const blocked = []
  for (const table of tables) {
    const toMap = (entries) =>
      new Map((entries ?? []).map(([primaryKey, version]) => [rowKey(table, primaryKey), version]))
    const ordered = worktreeSchema.tables[table].columns.includes("updated_at")
    const { added, changed, conflicts } = compareRows({
      main: toMap(mainVersions[table]),
      worktree: toMap(worktreeVersions[table]),
      ordered,
    })
    const count = added.length + changed.length + conflicts.length
    if (!count) continue
    const problem = tableProblem({
      table,
      worktreeSchema: worktreeSchema.tables,
      mainSchema: mainSchema.tables,
    })
    if (problem) {
      blocked.push({ table, rows: count, reason: problem })
      continue
    }
    for (const [kind, keys] of [
      ["added", added],
      ["changed", changed],
      ["conflict", conflicts],
    ]) {
      for (const key of keys) changes.push({ key, table, kind })
    }
  }

  // What to show of each row: its keys, foreign keys, label and state columns.
  const foreignKeys = usableForeignKeys(worktreeSchema)
  const foreignColumns = new Map()
  for (const foreignKey of foreignKeys) {
    if (!foreignColumns.has(foreignKey.table)) foreignColumns.set(foreignKey.table, new Set())
    for (const column of foreignKey.columns) foreignColumns.get(foreignKey.table).add(column)
  }
  const pick = (table, columns) => {
    const wanted = new Set([
      ...worktreeSchema.tables[table].primaryKey,
      ...(foreignColumns.get(table) ?? []),
      ...LABEL_COLUMNS,
      ...STATE_COLUMNS,
    ])
    return columns.filter((column) => wanted.has(column))
  }
  const keysByTable = groupKeys(changes)
  const rows = readRows(postgres, worktreeDatabase, worktreeSchema, keysByTable, pick)

  // What each change references: new rows it requires, and existing rows that name its context.
  const changeKeys = new Set(changes.map((change) => change.key))
  const addedKeys = new Set(
    changes.filter((change) => change.kind === "added").map((change) => change.key),
  )
  const requires = new Map()
  const contextRefs = new Map()
  for (const change of changes) {
    change.row = rows.get(change.key) ?? {}
    for (const foreignKey of foreignKeys.filter((candidate) => candidate.table === change.table)) {
      const values = foreignKey.columns.map((column) => change.row[column])
      if (values.some((value) => value === null || value === undefined)) continue
      const target = rowKey(foreignKey.references, values)
      if (addedKeys.has(target)) {
        if (!requires.has(change.key)) requires.set(change.key, new Set())
        requires.get(change.key).add(target)
      } else if (!changeKeys.has(target)) {
        if (!contextRefs.has(change.key)) contextRefs.set(change.key, [])
        contextRefs.get(change.key).push({ table: foreignKey.references, key: target, values })
      }
    }
  }

  // Names of the existing rows a change points at: "in project Wargame".
  const contextKeys = new Map()
  for (const refs of contextRefs.values()) {
    for (const ref of refs) {
      if (!contextKeys.has(ref.table)) contextKeys.set(ref.table, [])
      contextKeys.get(ref.table).push(ref.values)
    }
  }
  const contextRows = readRows(
    postgres,
    worktreeDatabase,
    worktreeSchema,
    contextKeys,
    (table, columns) => {
      const labels = columns.filter((column) => LABEL_COLUMNS.includes(column))
      return labels.length ? [...worktreeSchema.tables[table].primaryKey, ...labels] : null
    },
  )

  const changesByKey = new Map(changes.map((change) => [change.key, change]))
  const skippedTables = new Set(readJson(PREFERENCES_FILE, {}).skippedTables ?? [])
  const labelled = changes.map((change) => {
    const primaryKey = JSON.parse(change.key.slice(change.table.length + 1))
    const label = rowLabel(change.table, change.row, primaryKey)
    // The named rows it points at: new ones of its group first, then existing ones.
    const newParents = [...(requires.get(change.key) ?? [])]
      .map((target) => changesByKey.get(target))
      .filter((parent) => parent && LABEL_COLUMNS.some((column) => parent.row[column]))
      .map(
        (parent) =>
          `${parent.table} ${LABEL_COLUMNS.map((column) => parent.row[column]).find(Boolean)}`,
      )
    const existingParents = (contextRefs.get(change.key) ?? []).map((ref) => {
      const row = contextRows.get(ref.key)
      const name = row && LABEL_COLUMNS.map((column) => row[column]).find(Boolean)
      return name ? `${ref.table} ${name}` : null
    })
    const context = [...newParents, ...existingParents].filter(Boolean).slice(0, 3)
    return {
      key: change.key,
      table: change.table,
      kind: change.kind,
      label,
      named: LABEL_COLUMNS.some((column) => change.row[column]),
      context,
      state: STATE_COLUMNS.filter((column) => change.row[column]).map((column) =>
        column === "status" ? change.row.status : column.replace(/_at$/u, ""),
      ),
      requires: [...(requires.get(change.key) ?? [])],
      selected: selectedByDefault(change, { now, skippedTables }),
    }
  })
  return {
    mainDatabase,
    worktreeDatabase,
    missingMigrations: migrations,
    blocked,
    groups: groupChanges(labelled, requires),
  }
}

function groupKeys(changes) {
  const byTable = new Map()
  for (const change of changes) {
    if (!byTable.has(change.table)) byTable.set(change.table, [])
    byTable.get(change.table).push(JSON.parse(change.key.slice(change.table.length + 1)))
  }
  return byTable
}

/**
 * Writes the selected changes, with the new rows they require, into the main database, after a
 * restore point. Returns the restore point and what was written.
 */
export function applyPromotion({ postgres, promotion, selectedKeys, slug }) {
  if (promotion.missingMigrations.length) {
    throw new Error(
      `The main database lacks migrations of the worktree (${promotion.missingMigrations.join(", ")}): run npm run migration:run -w apps/api in the main checkout first.`,
    )
  }
  const changes = new Map(
    promotion.groups.flatMap((group) => group.changes).map((change) => [change.key, change]),
  )
  const unknown = selectedKeys.filter((key) => !changes.has(key))
  if (unknown.length) {
    throw new Error(`${unknown.length} selected rows are no longer in the diff: show it again.`)
  }
  const requires = new Map(
    [...changes.values()].map((change) => [change.key, new Set(change.requires)]),
  )
  const keys = [...closure(selectedKeys, requires)]
  if (!keys.length) throw new Error("Nothing selected.")
  const selected = keys.map((key) => changes.get(key))

  const worktreeSchema = readSchema(postgres, promotion.worktreeDatabase)
  const keysByTable = groupKeys(selected)
  const rows = readRows(
    postgres,
    promotion.worktreeDatabase,
    worktreeSchema,
    keysByTable,
    () => null,
  )
  const statements = []
  for (const [table, tableKeys] of keysByTable) {
    const { columns, primaryKey } = worktreeSchema.tables[table]
    const tableRows = tableKeys.map((key) => rows.get(rowKey(table, key))).filter(Boolean)
    for (let start = 0; start < tableRows.length; start += ROWS_PER_STATEMENT) {
      statements.push({
        table,
        columns,
        primaryKey,
        rows: tableRows.slice(start, start + ROWS_PER_STATEMENT),
      })
    }
  }
  const summary = summarize(selected)
  const restorePoint = createRestorePoint({
    postgres,
    database: promotion.mainDatabase,
    reason: `before importing from ${slug}`,
    summary,
  })
  psql(
    postgres,
    promotion.mainDatabase,
    applySql(statements, `wt${randomBytes(8).toString("hex")}`),
  )

  // Tables of rows tied to nothing (messages, activities) that the user left out entirely start
  // unselected next time. Rows of a group are never learned from: picking an installation without
  // its permissions once must not leave out the permissions of every next app.
  const required = new Set([...requires.values()].flatMap((targets) => [...targets]))
  const isolated = [...changes.values()].filter(
    (change) => !change.requires.length && !required.has(change.key),
  )
  const preferences = readJson(PREFERENCES_FILE, {})
  writeFileAtomic(
    PREFERENCES_FILE,
    `${JSON.stringify(
      {
        ...preferences,
        skippedTables: rememberSkippedTables(preferences.skippedTables ?? [], {
          offered: new Set(isolated.map((change) => change.table)),
          selected: new Set(selected.map((change) => change.table)),
        }),
      },
      null,
      2,
    )}\n`,
  )
  return { restorePoint, summary, count: selected.length }
}

/** "app_installation: 2 new, agent_settings: 1 changed". */
export function summarize(changes) {
  const counts = new Map()
  for (const change of changes) {
    const key = `${change.table}|${change.kind}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, count]) => {
      const [table, kind] = key.split("|")
      return `${table}: ${count} ${kind === "added" ? "new" : kind}`
    })
    .join(", ")
}

// --- Restore points of the main database ------------------------------------------------------

/** A full dump of the main database, kept 14 days, with what is about to change. */
export function createRestorePoint({ postgres, database, reason, summary = "" }) {
  mkdirSync(RESTORE_POINTS_DIR, { recursive: true, mode: 0o700 })
  pruneRestorePoints()
  const id = restorePointId(new Date())
  const dump = join(RESTORE_POINTS_DIR, `${id}.dump`)
  const output = openSync(dump, "w", 0o600)
  try {
    const result = spawnSync(
      "docker",
      ["exec", postgres, "pg_dump", "-U", "admin", "-Fc", "-d", database],
      {
        stdio: ["ignore", output, "inherit"],
      },
    )
    if (result.status !== 0) {
      rmSync(dump, { force: true })
      throw new Error(`pg_dump of ${database} failed: nothing was changed.`)
    }
  } finally {
    closeSync(output)
  }
  writeFileAtomic(
    join(RESTORE_POINTS_DIR, `${id}.json`),
    `${JSON.stringify({ id, database, reason, summary, createdAt: new Date().toISOString() }, null, 2)}\n`,
    0o600,
  )
  return id
}

export function listRestorePoints() {
  if (!existsSync(RESTORE_POINTS_DIR)) return []
  return readdirSync(RESTORE_POINTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(join(RESTORE_POINTS_DIR, name), null))
    .filter((point) => point && existsSync(join(RESTORE_POINTS_DIR, `${point.id}.dump`)))
    .sort((first, second) => second.id.localeCompare(first.id))
}

/**
 * Puts the main database back as it was at a restore point. It first takes a restore point of
 * the current state, so a restore can be undone too, then loads the dump into a new database and
 * swaps it with the main one: the main API reconnects to it.
 */
export function restoreMainDatabase({ postgres, id }) {
  if (!validRestorePointId(id))
    throw new Error(`No restore point ${id}: npm run wt -- restore-main lists them.`)
  const point = readJson(join(RESTORE_POINTS_DIR, `${id}.json`), null)
  const dump = join(RESTORE_POINTS_DIR, `${id}.dump`)
  if (!point || !existsSync(dump))
    throw new Error(`No restore point ${id}: npm run wt -- restore-main lists them.`)
  const database = point.database
  if (!/^[a-z0-9_]+$/u.test(database)) throw new Error(`Unexpected database name ${database}`)
  const before = createRestorePoint({ postgres, database, reason: `before restoring ${id}` })
  const restoring = `${database}__restoring`
  const replaced = `${database}__replaced`
  psql(postgres, "postgres", `DROP DATABASE IF EXISTS ${quote(restoring)} WITH (FORCE);`)
  psql(postgres, "postgres", `CREATE DATABASE ${quote(restoring)};`)
  const input = openSync(dump, "r")
  try {
    const result = spawnSync(
      "docker",
      ["exec", "-i", postgres, "pg_restore", "-U", "admin", "--no-owner", "-d", restoring],
      { stdio: [input, "inherit", "inherit"] },
    )
    if (result.status !== 0) {
      psql(postgres, "postgres", `DROP DATABASE IF EXISTS ${quote(restoring)} WITH (FORCE);`)
      throw new Error(`pg_restore of ${id} failed: the main database is unchanged.`)
    }
  } finally {
    closeSync(input)
  }
  // Nobody connects while the names swap, then the old copy goes.
  psql(
    postgres,
    "postgres",
    `ALTER DATABASE ${quote(database)} WITH ALLOW_CONNECTIONS false;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();
ALTER DATABASE ${quote(database)} RENAME TO ${quote(replaced)};
ALTER DATABASE ${quote(restoring)} RENAME TO ${quote(database)};`,
  )
  psql(postgres, "postgres", `DROP DATABASE ${quote(replaced)} WITH (FORCE);`)
  return { database, before }
}

function pruneRestorePoints() {
  const limit = Date.now() - RESTORE_POINT_DAYS * 24 * 60 * 60 * 1000
  for (const name of readdirSync(RESTORE_POINTS_DIR)) {
    const path = join(RESTORE_POINTS_DIR, name)
    if (statSync(path).mtimeMs < limit) rmSync(path, { force: true })
  }
}

export function readRestorePoint(id) {
  return validRestorePointId(id) ? readJson(join(RESTORE_POINTS_DIR, `${id}.json`), null) : null
}
