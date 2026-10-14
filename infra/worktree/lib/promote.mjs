// Brings the data of a worktree's database into the main checkout's, which every new worktree
// copies: what changed, in coherent groups, then the SQL that applies a selection. Everything is
// read from the schema (primary keys, foreign keys, columns), so a new table needs nothing here.
// Pure functions only.

// TypeORM's own tables: never data to bring over.
export const IGNORED_TABLES = new Set(["migrations", "typeorm_metadata"])
// The first of these columns that a row has names it on the dashboard.
const LABEL_COLUMNS = ["name", "title", "label", "email", "slug", "key"]
const RESTORE_POINT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/u

/** The key of a row: its table and the values of its primary key. */
export function rowKey(table, primaryKey) {
  return `${table}:${JSON.stringify(primaryKey)}`
}

/** Migrations the worktree ran that the main database did not: data of those could not land. */
export function missingMigrations({ main, worktree }) {
  const applied = new Set(main)
  return worktree.filter((name) => !applied.has(name))
}

/**
 * Why a table cannot be brought over, or null: no primary key, generated ids that would collide
 * with the main database's, or columns the main database lacks.
 */
export function tableProblem({ table, worktreeSchema, mainSchema }) {
  if (IGNORED_TABLES.has(table)) return "TypeORM's own table"
  const own = worktreeSchema[table]
  if (!own.primaryKey.length) return "no primary key"
  if (own.generatedKey) return "its ids come from a sequence and would collide"
  const main = mainSchema[table]
  if (!main) return "the main database does not have this table"
  const missing = own.columns.filter((column) => !main.columns.includes(column))
  if (missing.length) return `the main database lacks ${missing.join(", ")}`
  return null
}

/**
 * Compares the rows of a table, by primary key. `main` and `worktree` map a row key to its
 * version: its updated_at when the table has one, else a hash of the row. Rows only in the main
 * database are left alone: nothing is ever deleted there.
 */
export function compareRows({ main, worktree, ordered }) {
  const added = []
  const changed = []
  const conflicts = []
  for (const [key, version] of worktree) {
    if (!main.has(key)) added.push(key)
    else if (main.get(key) !== version) {
      // With updated_at, a newer row in the main database means it changed there too.
      if (ordered && main.get(key) > version) conflicts.push(key)
      else changed.push(key)
    }
  }
  return { added, changed, conflicts }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/**
 * The name of a row on the dashboard: its first label column, else the parts of its primary key
 * that are not uuids (a permission key), else a short id.
 */
export function rowLabel(_table, row, primaryKey) {
  const column = LABEL_COLUMNS.find((name) => typeof row?.[name] === "string" && row[name])
  if (column) return row[column]
  const readable = primaryKey.map(String).filter((value) => !UUID_PATTERN.test(value))
  if (readable.length) return readable.join(", ")
  const id = primaryKey.map(String).join(", ")
  return id.length > 13 ? `${id.slice(0, 8)}…` : id
}

/**
 * Whether a change is selected by default: new rows, except revoked, consumed or expired ones,
 * and those of tables left out last time. Changes to rows of the main database and conflicts are
 * always a choice.
 */
export function selectedByDefault(change, { now, skippedTables }) {
  if (change.kind !== "added") return false
  if (skippedTables.has(change.table)) return false
  const row = change.row ?? {}
  if (row.revoked_at || row.consumed_at) return false
  if (row.expires_at && Date.parse(row.expires_at) < now) return false
  return true
}

/**
 * Groups changes that belong together: a row and the new rows it references, transitively, as
 * an installation, its manifest, its service user and the user's memberships. References to rows
 * the main database already has do not join groups, or a user who signed in again would join
 * everything they ever created. `requires` maps a change to the new rows it references.
 */
export function groupChanges(changes, requires) {
  const parent = new Map(changes.map((change) => [change.key, change.key]))
  const find = (key) => {
    while (parent.get(key) !== key) {
      parent.set(key, parent.get(parent.get(key)))
      key = parent.get(key)
    }
    return key
  }
  for (const [key, targets] of requires) {
    for (const target of targets) parent.set(find(key), find(target))
  }
  const groups = new Map()
  for (const change of changes) {
    const root = find(change.key)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(change)
  }
  const dependents = invert(requires)
  const titled = []
  // Rows alone in their group (messages, activities) gather per table, to be picked at once.
  const alone = new Map()
  for (const members of groups.values()) {
    if (members.length === 1) {
      const [change] = members
      if (!alone.has(change.table)) alone.set(change.table, [])
      alone.get(change.table).push(change)
      continue
    }
    // Its title: a named row that requires nothing, of the table with the fewest rows in the
    // group (the app rather than its two roles), reaching the most of the others.
    const perTable = new Map()
    for (const change of members) perTable.set(change.table, (perTable.get(change.table) ?? 0) + 1)
    const reach = (key) => closure([key], dependents).size
    const requiresSomething = (key) => (requires.get(key)?.size ? 1 : 0)
    const [head] = [...members].sort(
      (first, second) =>
        Number(Boolean(second.named)) - Number(Boolean(first.named)) ||
        requiresSomething(first.key) - requiresSomething(second.key) ||
        perTable.get(first.table) - perTable.get(second.table) ||
        reach(second.key) - reach(first.key) ||
        first.key.localeCompare(second.key),
    )
    titled.push({
      title: `${head.table} ${head.label}`,
      changes: sortByDependencies(members, requires),
    })
  }
  for (const [table, members] of alone) {
    titled.push({
      title:
        members.length === 1 ? `${table} ${members[0].label}` : `${table}: ${members.length} rows`,
      changes: sortByDependencies(members, requires),
      gathered: members.length > 1,
    })
  }
  return (
    titled
      .map((group) => ({ ...group, summary: countByTable(group.changes) }))
      // Things made together first, then rows gathered per table.
      .sort(
        (first, second) =>
          Number(Boolean(first.gathered)) - Number(Boolean(second.gathered)) ||
          first.title.localeCompare(second.title),
      )
  )
}

/** "app_installation 2, role 2, user 2". */
function countByTable(changes) {
  const counts = new Map()
  for (const change of changes) counts.set(change.table, (counts.get(change.table) ?? 0) + 1)
  return [...counts].map(([table, count]) => `${table} ${count}`).join(", ")
}

/** The keys and everything they reach through `edges`, themselves included. */
export function closure(keys, edges) {
  const reached = new Set()
  const pending = [...keys]
  while (pending.length) {
    const key = pending.pop()
    if (reached.has(key)) continue
    reached.add(key)
    for (const next of edges.get(key) ?? []) pending.push(next)
  }
  return reached
}

export function invert(edges) {
  const inverted = new Map()
  for (const [key, targets] of edges) {
    for (const target of targets) {
      if (!inverted.has(target)) inverted.set(target, new Set())
      inverted.get(target).add(key)
    }
  }
  return inverted
}

/** Rows a group shows first: those the others depend on. */
function sortByDependencies(members, requires) {
  const keys = new Set(members.map((change) => change.key))
  const depth = new Map()
  const depthOf = (key, seen = new Set()) => {
    if (depth.has(key)) return depth.get(key)
    if (seen.has(key)) return 0
    seen.add(key)
    const targets = [...(requires.get(key) ?? [])].filter((target) => keys.has(target))
    const value = targets.length
      ? 1 + Math.max(...targets.map((target) => depthOf(target, seen)))
      : 0
    depth.set(key, value)
    return value
  }
  return [...members].sort(
    (first, second) =>
      depthOf(first.key) - depthOf(second.key) ||
      first.table.localeCompare(second.table) ||
      first.label.localeCompare(second.label),
  )
}

/**
 * The tables the user left out entirely, remembered so that they start unselected next time;
 * a table they picked a row of is forgotten.
 */
export function rememberSkippedTables(previous, { offered, selected }) {
  const skipped = new Set(previous)
  for (const table of offered) {
    if (selected.has(table)) skipped.delete(table)
    else skipped.add(table)
  }
  return [...skipped].sort()
}

/**
 * The SQL that writes rows into the main database: an upsert per table, in one transaction.
 * Foreign keys are not checked while it loads, since the selection carries the new rows each row
 * references, cycles included. The JSON goes inside a dollar quote with a tag it cannot contain.
 */
export function applySql(tables, tag) {
  const statements = ["BEGIN;", "SET LOCAL session_replication_role = replica;"]
  for (const { table, columns, primaryKey, rows } of tables) {
    if (!rows.length) continue
    const json = JSON.stringify(rows)
    if (json.includes(`$${tag}$`)) throw new Error("The rows contain the quoting tag")
    const list = columns.map(quote).join(", ")
    const others = columns.filter((column) => !primaryKey.includes(column))
    const onConflict = others.length
      ? `DO UPDATE SET (${others.map(quote).join(", ")}) = ROW(${others.map((column) => `EXCLUDED.${quote(column)}`).join(", ")})`
      : "DO NOTHING"
    statements.push(
      `INSERT INTO ${quote(table)} (${list}) SELECT ${list} FROM json_populate_recordset(NULL::${quote(table)}, $${tag}$${json}$${tag}$) ON CONFLICT (${primaryKey.map(quote).join(", ")}) ${onConflict};`,
    )
  }
  statements.push("COMMIT;")
  return statements.join("\n")
}

export function quote(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`
}

/** The id of a restore point: when it was taken, usable in a file name. */
export function restorePointId(date) {
  return date.toISOString().replaceAll(":", "-").replace(".", "-")
}

export function validRestorePointId(id) {
  return typeof id === "string" && RESTORE_POINT_PATTERN.test(id)
}
