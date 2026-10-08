import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildState,
  containerHealth,
  describeHost,
  environmentState,
  hostname,
  publicUrl,
} from "./model.mjs"

function container({
  slug,
  service,
  state = "running",
  status = "Up 2 minutes (healthy)",
  links = {},
}) {
  const labels = {
    "dev.worktree.slug": slug,
    "dev.worktree.service": service,
    "dev.worktree.path": `/repo/.claude/worktrees/${slug}`,
  }
  for (const [name, url] of Object.entries(links)) labels[`dev.worktree.link.${name}`] = url
  return { State: state, Status: status, Labels: labels }
}

function sharedContainer(service, state = "running", status = "Up 2 days") {
  return {
    State: state,
    Status: status,
    Labels: { "com.docker.compose.project": "connect-db", "com.docker.compose.service": service },
  }
}

describe("containerHealth", () => {
  it("reads the Docker health check", () => {
    assert.equal(containerHealth({ State: "running", Status: "Up 1 minute (healthy)" }), "healthy")
    assert.equal(
      containerHealth({ State: "running", Status: "Up 1 minute (unhealthy)" }),
      "unhealthy",
    )
    assert.equal(
      containerHealth({ State: "running", Status: "Up 5 seconds (health: starting)" }),
      "starting",
    )
    assert.equal(containerHealth({ State: "running", Status: "Up 1 minute" }), "running")
  })

  it("tells a finished one-shot from a failed one", () => {
    assert.equal(
      containerHealth({ State: "exited", Status: "Exited (0) 1 minute ago" }, true),
      "done",
    )
    assert.equal(
      containerHealth({ State: "exited", Status: "Exited (1) 1 minute ago" }, true),
      "failed",
    )
    assert.equal(containerHealth({ State: "exited", Status: "Exited (0) 1 minute ago" }), "stopped")
  })
})

describe("environmentState", () => {
  it("is ready when every service is ready or done", () => {
    assert.equal(environmentState([{ health: "healthy" }, { health: "done" }]), "ready")
  })

  it("reports a problem first", () => {
    assert.equal(environmentState([{ health: "starting" }, { health: "failed" }]), "problem")
  })

  it("is starting while a service is not ready", () => {
    assert.equal(environmentState([{ health: "healthy" }, { health: "starting" }]), "starting")
  })

  it("is stopped when everything is stopped", () => {
    assert.equal(environmentState([{ health: "stopped" }, { health: "stopped" }]), "stopped")
  })
})

describe("buildState", () => {
  const state = buildState({
    containers: [
      container({
        slug: "fix-sidebar",
        service: "web",
        links: { app: "http://fix-sidebar.connect.localhost:8800" },
      }),
      container({
        slug: "fix-sidebar",
        service: "api",
        links: {
          "bull-board": "http://fix-sidebar.connect.localhost:8800/api/internal/bull-board",
        },
      }),
      container({
        slug: "fix-sidebar",
        service: "migrate",
        state: "exited",
        status: "Exited (0) 3 minutes ago",
      }),
      container({ slug: "another", service: "web", status: "Up 3 seconds (health: starting)" }),
      sharedContainer("phoenix"),
      sharedContainer("pgvector"),
      sharedContainer("grafana", "exited", "Exited (255) 6 days ago"),
      { State: "running", Status: "Up", Labels: { "com.docker.compose.project": "supabase" } },
    ],
    status: {
      environments: {
        "fix-sidebar": {
          branch: "fix/sidebar",
          pr: { number: 951, state: "OPEN", url: "https://github.com/x/y/pull/951" },
          databases: { app: "connect_wt_fix_sidebar", test: "connect_wt_fix_sidebar__test" },
        },
      },
    },
    routerPort: 8800,
    now: "2026-10-08T12:00:00.000Z",
  })

  it("groups the containers of each environment, sorted by name", () => {
    assert.deepEqual(
      state.environments.map((environment) => environment.slug),
      ["another", "fix-sidebar"],
    )
    const environment = state.environments[1]
    assert.equal(environment.state, "ready")
    assert.deepEqual(
      environment.services.map((service) => `${service.name}:${service.health}`),
      ["api:healthy", "migrate:done", "web:healthy"],
    )
  })

  it("orders the links and adds the Phoenix project of the environment", () => {
    const environment = state.environments[1]
    assert.deepEqual(
      environment.links.map((entry) => entry.name),
      ["app", "bull-board"],
    )
    assert.equal(
      environment.tracesUrl,
      "http://phoenix.connect.localhost:8800/redirects/projects/wt-fix-sidebar",
    )
    assert.equal(environment.branch, "fix/sidebar")
    assert.equal(environment.pr.number, 951)
  })

  it("lists the shared stack, with links for the services Traefik routes", () => {
    assert.deepEqual(
      state.shared.map((entry) => [entry.name, entry.health, entry.url]),
      [
        ["grafana", "stopped", null],
        ["pgvector", "running", null],
        ["phoenix", "running", "http://phoenix.connect.localhost:8800"],
      ],
    )
  })

  it("finds the environment behind a host, or guesses the worktree name", () => {
    const known = describeHost(state, "fix-sidebar.connect.localhost")
    assert.equal(known.environment.slug, "fix-sidebar")
    assert.equal(known.service, "web")
    const unknown = describeHost(state, "new-thing-storybook.connect.localhost")
    assert.equal(unknown.environment, null)
    assert.equal(unknown.guess, "new-thing")
  })
})

describe("hostname and publicUrl", () => {
  it("drops the port and lowercases", () => {
    assert.equal(hostname("Fix-Sidebar.connect.localhost:8800"), "fix-sidebar.connect.localhost")
  })

  it("omits port 80", () => {
    assert.equal(publicUrl("dev", 80), "http://dev.connect.localhost")
    assert.equal(publicUrl("dev", 8800), "http://dev.connect.localhost:8800")
  })
})
