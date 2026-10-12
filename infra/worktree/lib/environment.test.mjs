import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  composeVariables,
  DEFAULT_SMTP_FROM,
  formatComposeEnv,
  hostEnvValues,
  missingNodeModulesVolumes,
  parseComposeEnv,
  pickRedisPort,
  TEMPLATE_NODE_MODULES_FOLDERS,
  withDatabase,
} from "./environment.mjs"
import { environmentNames, nodeModulesFolders } from "./naming.mjs"

const names = environmentNames("fix-sidebar", 8800)
const gcp = { hostPath: "/home/dev/keys/dev.json", inContainer: "/run/secrets/gcp.json" }

describe("composeVariables", () => {
  const variables = composeVariables({
    names,
    worktreePath: "/repo/.claude/worktrees/fix-sidebar",
    repository: "/repo",
    uid: 1000,
    gid: 1000,
    routerPort: 8800,
    redisPort: 16380,
    sourceDatabase: "connect",
    gcpCredentials: gcp,
    gcsBucket: undefined,
    smtpFrom: undefined,
    lockHash: "abc",
    dexDir: "/home/dev/.bayes-worktrees/envs/fix-sidebar",
  })

  it("sets every variable the compose template reads", () => {
    const template = readFileSync(new URL("../docker-compose.yaml", import.meta.url), "utf8")
    const used = new Set([...template.matchAll(/\$\{(WT_[A-Z_]+)/gu)].map((match) => match[1]))
    for (const variable of used) assert.ok(variable in variables, variable)
  })

  it("gives every environment its own Traefik routers", () => {
    // Compose interpolates the keys of labels written as a list, never as a map. A map key such
    // as `traefik.http.routers.wt-${WT_SLUG}-web.rule` stays literal, so two environments declare
    // the same router with different rules, and Traefik drops both.
    const template = readFileSync(new URL("../docker-compose.yaml", import.meta.url), "utf8")
    const literalKeys = template
      .split("\n")
      .filter((line) => /^\s*[^\s#-][^\s:]*\$\{[^}]+\}[^\s:]*:(\s|$)/u.test(line))
    assert.deepEqual(literalKeys, [])
  })

  it("names the compose project and defaults the optional values", () => {
    assert.equal(variables.COMPOSE_PROJECT_NAME, "wt-fix-sidebar")
    assert.equal(variables.WT_GCS_BUCKET, "")
    assert.equal(variables.WT_SMTP_FROM, DEFAULT_SMTP_FROM)
  })

  it("round-trips through the .env format, spaces and angle brackets included", () => {
    assert.deepEqual(parseComposeEnv(formatComposeEnv(variables)), variables)
  })

  it("refuses a value that the .env format cannot hold", () => {
    assert.throws(() => formatComposeEnv({ WT_PATH: "/it's/here" }), /quote or a line break/u)
  })
})

describe("hostEnvValues", () => {
  it("points the host commands at the environment's database, Redis and credentials", () => {
    const values = hostEnvValues({
      names,
      redisPort: 16381,
      gcpCredentials: gcp,
      testDatabaseUrl: "postgresql://connect_admin:passpass@localhost:5532/connect_test",
    })
    assert.deepEqual(values.api, {
      DATABASE_NAME: "connect_wt_fix_sidebar",
      DATABASE_URL: "",
      BULLMQ_REDIS_URL: "redis://127.0.0.1:16381",
      GOOGLE_APPLICATION_CREDENTIALS: "/home/dev/keys/dev.json",
    })
    assert.deepEqual(values.apiTest, {
      DATABASE_URL:
        "postgresql://connect_admin:passpass@localhost:5532/connect_wt_fix_sidebar__test",
    })
  })

  it("leaves the credentials and the test database alone when there are none", () => {
    const values = hostEnvValues({
      names,
      redisPort: 16381,
      gcpCredentials: { hostPath: "/tmp/none.json", inContainer: "" },
      testDatabaseUrl: undefined,
    })
    assert.equal(values.api.GOOGLE_APPLICATION_CREDENTIALS, undefined)
    assert.deepEqual(values.apiTest, {})
  })
})

describe("withDatabase", () => {
  it("keeps the credentials, host, port and query", () => {
    assert.equal(
      withDatabase("postgresql://user:p%40ss@localhost:5432/connect_test?sslmode=disable", "x"),
      "postgresql://user:p%40ss@localhost:5432/x?sslmode=disable",
    )
  })
})

describe("pickRedisPort", () => {
  const free = async () => true

  it("keeps the port the environment had when no other environment has it", async () => {
    assert.equal(await pickRedisPort({ previous: 16390, taken: new Set(), isFree: free }), 16390)
  })

  it("leaves the port it had when something else listens on it", async () => {
    const isFree = async (port) => port !== 16390
    assert.equal(await pickRedisPort({ previous: 16390, taken: new Set(), isFree }), 16380)
  })

  it("skips the ports of other environments, started or only recorded", async () => {
    const taken = new Set([16380, 16381])
    assert.equal(await pickRedisPort({ previous: 16380, taken, isFree: free }), 16382)
  })

  it("skips the ports something else listens on", async () => {
    const isFree = async (port) => port !== 16380
    assert.equal(await pickRedisPort({ previous: 0, taken: new Set(), isFree }), 16381)
  })

  it("says so when the range is full", async () => {
    await assert.rejects(
      pickRedisPort({ previous: 0, taken: new Set(), isFree: async () => false }),
      /No free port/u,
    )
  })
})

describe("node_modules volumes", () => {
  it("covers every node_modules folder of the repository's package-lock.json", () => {
    const lock = JSON.parse(
      readFileSync(new URL("../../../package-lock.json", import.meta.url), "utf8"),
    )
    assert.deepEqual(missingNodeModulesVolumes(nodeModulesFolders(lock)), [])
  })

  it("matches the volumes of the compose template and init.sh", () => {
    const template = readFileSync(new URL("../docker-compose.yaml", import.meta.url), "utf8")
    const init = readFileSync(new URL("../init.sh", import.meta.url), "utf8")
    for (const folder of TEMPLATE_NODE_MODULES_FOLDERS) {
      const target = folder ? `\${WT_PATH}/${folder}/node_modules` : `\${WT_PATH}/node_modules`
      assert.equal(template.split(`target: "${target}"`).length - 1, 2, `${target} in the template`)
      assert.ok(init.includes(folder ? `${folder}/node_modules` : "node_modules"), folder)
    }
  })

  it("reports the folders the template lacks", () => {
    assert.deepEqual(missingNodeModulesVolumes(["", "apps/api", "apps/new"]), ["apps/new"])
  })
})
