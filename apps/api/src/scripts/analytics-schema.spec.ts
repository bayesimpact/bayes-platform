import { Client } from "pg"
import {
  ANALYTICS_FORBIDDEN_COLUMNS,
  ANALYTICS_FORBIDDEN_SUFFIXES,
  ANALYTICS_READER_ROLE,
  ANALYTICS_REQUIRED_COLUMNS,
  ANALYTICS_SCHEMA,
  ANALYTICS_VIEWS,
} from "./analytics-schema.constants"

type ColumnRow = { table_name: string; column_name: string }

/**
 * The analytics schema is what a dashboard tool reads with a read-only role.
 * These tests read the database catalog, so a view cannot expose a column
 * below the workspace level without failing here. The schema comes from the
 * migrations, not from TypeORM's synchronize: the test database must have
 * them applied (`npm run migration:test:run`, done by `make tests` and CI).
 */
describe("analytics schema", () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  let columnsByView: Map<string, string[]>

  beforeAll(async () => {
    await client.connect()
    const schema = await client.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [
      ANALYTICS_SCHEMA,
    ])
    if (schema.rowCount === 0) {
      throw new Error(
        `Schema ${ANALYTICS_SCHEMA} is missing from the test database: run \`npm run migration:test:run\` first`,
      )
    }
    const rows = await client.query<ColumnRow>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = $1
       ORDER BY table_name, ordinal_position`,
      [ANALYTICS_SCHEMA],
    )
    columnsByView = new Map()
    for (const row of rows.rows) {
      const columns = columnsByView.get(row.table_name) ?? []
      columns.push(row.column_name)
      columnsByView.set(row.table_name, columns)
    }
  })

  afterAll(async () => {
    await client.end()
  })

  it("contains exactly the declared views", () => {
    expect([...columnsByView.keys()].sort()).toEqual([...ANALYTICS_VIEWS].sort())
  })

  it("contains views only, no tables", async () => {
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type <> 'VIEW'`,
      [ANALYTICS_SCHEMA],
    )
    expect(tables.rows).toEqual([])
  })

  it("is not registered in TypeORM: the views are not entities", async () => {
    // typeorm_metadata exists only once TypeORM has recorded a view or a
    // generated column; a database built by the migrations may not have it.
    const registered = await client
      .query(`SELECT 1 FROM typeorm_metadata WHERE schema = $1 AND type = 'VIEW'`, [
        ANALYTICS_SCHEMA,
      ])
      .catch((error: { code?: string }) => {
        if (error.code === "42P01") return { rowCount: 0 } // undefined_table
        throw error
      })
    expect(registered.rowCount).toBe(0)
  })

  it("has the reader role, without login, with nothing on public", async () => {
    const role = await client.query<{ rolcanlogin: boolean }>(
      "SELECT rolcanlogin FROM pg_roles WHERE rolname = $1",
      [ANALYTICS_READER_ROLE],
    )
    expect(role.rows).toEqual([{ rolcanlogin: false }])
    const onPublic = await client.query(
      `SELECT 1 FROM information_schema.role_table_grants
       WHERE grantee = $1 AND table_schema = 'public'`,
      [ANALYTICS_READER_ROLE],
    )
    expect(onPublic.rowCount).toBe(0)
  })

  it.each(ANALYTICS_VIEWS)("%s carries the workspace columns", (view) => {
    const columns = columnsByView.get(view) ?? []
    for (const required of ANALYTICS_REQUIRED_COLUMNS) {
      expect(columns).toContain(required)
    }
  })

  it.each(ANALYTICS_VIEWS)("%s exposes nothing below the workspace", (view) => {
    const columns = columnsByView.get(view) ?? []
    const forbidden = new Set<string>(ANALYTICS_FORBIDDEN_COLUMNS)
    const leaked = columns.filter(
      (column) =>
        forbidden.has(column) ||
        ANALYTICS_FORBIDDEN_SUFFIXES.some((suffix) => column.endsWith(suffix)),
    )
    expect(leaked).toEqual([])
  })

  it.each(ANALYTICS_VIEWS)("%s is readable by the reader role", async (view) => {
    // The migration user created the role, so it holds the ADMIN OPTION but
    // not SET (Postgres 16): grant itself SET for the transaction, rolled back.
    await client.query("BEGIN")
    try {
      await client.query(`GRANT ${ANALYTICS_READER_ROLE} TO CURRENT_USER WITH SET TRUE`)
      await client.query(`SET LOCAL ROLE ${ANALYTICS_READER_ROLE}`)
      await expect(
        client.query(`SELECT * FROM ${ANALYTICS_SCHEMA}.${view} LIMIT 1`),
      ).resolves.toBeDefined()
    } finally {
      await client.query("ROLLBACK")
    }
  })
})
