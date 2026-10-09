// What the dashboard shows, computed from the Docker containers and the status file written by
// the worktree tooling (branch, pull request, databases, cleanup verdict). Pure functions only,
// so they are tested without Docker.

export const DOMAIN = "connect.localhost"
export const DASHBOARD_HOST = `dev.${DOMAIN}`

// Labels set by infra/worktree/docker-compose.yaml on every container of an environment.
const SLUG_LABEL = "dev.worktree.slug"
const SERVICE_LABEL = "dev.worktree.service"
const PATH_LABEL = "dev.worktree.path"
const LINK_LABEL_PREFIX = "dev.worktree.link."
const COMPOSE_PROJECT_LABEL = "com.docker.compose.project"
const COMPOSE_SERVICE_LABEL = "com.docker.compose.service"

// Containers that run once and exit: exit code 0 means done.
const ONE_SHOT_SERVICES = new Set(["init", "db", "migrate"])

// Order of the links of an environment, then any other link alphabetically.
const LINK_ORDER = [
  "app",
  "bull-board",
  "grafana",
  "storybook",
  "ui-storybook",
  "embed",
  "embed-storybook",
  "help",
  "dex",
]

// The service behind each link, to point at its logs.
const LINK_SERVICES = {
  app: "web",
  "bull-board": "api",
  grafana: "grafana",
  storybook: "storybook-web",
  "ui-storybook": "storybook-ui",
  embed: "embed",
  "embed-storybook": "storybook-embed",
  help: "help",
  dex: "dex",
}

// How to start a shared service, with its route, from the main checkout.
const SHARED_SERVICES = {
  phoenix: { name: "phoenix", command: "docker compose --profile traces up -d phoenix" },
  mailpit: { name: "mailpit", command: "docker compose --profile mail up -d mailpit" },
  grafana: { name: "grafana", command: "docker compose --profile analytics up -d grafana" },
  traefik: { name: "traefik", command: "docker compose --profile router up -d traefik" },
}

// Services of the shared stack, with the hostname and path Traefik serves them on.
const SHARED_LINKS = {
  phoenix: ["phoenix", ""],
  mailpit: ["mail", ""],
  grafana: ["grafana", ""],
  traefik: ["traefik", "/dashboard/"],
}

/** Health of a container from the Docker API: running, healthy, starting, unhealthy, done... */
export function containerHealth(container, oneShot = false) {
  const status = container.Status ?? ""
  if (container.State === "running") {
    if (status.includes("(healthy)")) return "healthy"
    if (status.includes("(unhealthy)")) return "unhealthy"
    if (status.includes("(health: starting)")) return "starting"
    return "running"
  }
  if (container.State === "exited") {
    const exitCode = Number(status.match(/^Exited \((-?\d+)\)/u)?.[1] ?? Number.NaN)
    if (oneShot) return exitCode === 0 ? "done" : "failed"
    return "stopped"
  }
  if (container.State === "restarting") return "unhealthy"
  if (container.State === "created") return "starting"
  return container.State ?? "unknown"
}

const READY = new Set(["healthy", "running", "done"])
const PROBLEM = new Set(["unhealthy", "failed", "dead"])

/** The overall state of an environment from the health of its services. */
export function environmentState(services) {
  if (services.some((service) => PROBLEM.has(service.health))) return "problem"
  if (services.length > 0 && services.every((service) => service.health === "stopped")) {
    return "stopped"
  }
  if (services.every((service) => READY.has(service.health))) return "ready"
  return "starting"
}

export function buildState({ containers, status = {}, routerPort, now }) {
  const environments = new Map()
  const shared = []
  for (const container of containers) {
    const labels = container.Labels ?? {}
    const slug = labels[SLUG_LABEL]
    if (slug) {
      const environment = environments.get(slug) ?? {
        slug,
        path: null,
        services: [],
        links: new Map(),
      }
      environment.path ??= labels[PATH_LABEL] ?? null
      const service = labels[SERVICE_LABEL] ?? labels[COMPOSE_SERVICE_LABEL] ?? "unknown"
      const oneShot = ONE_SHOT_SERVICES.has(service)
      environment.services.push({ name: service, health: containerHealth(container, oneShot) })
      for (const [key, url] of Object.entries(labels)) {
        if (key.startsWith(LINK_LABEL_PREFIX)) {
          environment.links.set(key.slice(LINK_LABEL_PREFIX.length), url)
        }
      }
      environments.set(slug, environment)
    } else if (labels[COMPOSE_PROJECT_LABEL] === "connect-db") {
      const name = labels[COMPOSE_SERVICE_LABEL] ?? container.Names?.[0] ?? "unknown"
      const [host, path] = SHARED_LINKS[name] ?? []
      shared.push({
        name,
        health: containerHealth(container),
        url: host && container.State === "running" ? `${publicUrl(host, routerPort)}${path}` : null,
      })
    }
  }

  const phoenix = shared.find((entry) => entry.name === "phoenix" && entry.url)
  return {
    generatedAt: now,
    routerPort,
    dashboardUrl: publicUrl("dev", routerPort),
    shared: shared.sort((first, second) => first.name.localeCompare(second.name)),
    environments: [...environments.values()]
      .sort((first, second) => first.slug.localeCompare(second.slug))
      .map((environment) => {
        const details = status.environments?.[environment.slug] ?? {}
        return {
          slug: environment.slug,
          path: details.path ?? environment.path,
          branch: details.branch ?? null,
          pr: details.pr ?? null,
          databases: details.databases ?? null,
          cleanup: details.cleanup ?? null,
          state: environmentState(environment.services),
          services: environment.services.sort((first, second) =>
            first.name.localeCompare(second.name),
          ),
          links: sortLinks(environment.links),
          // Phoenix resolves the project by name, even before its first trace.
          tracesUrl: phoenix ? `${phoenix.url}/redirects/projects/wt-${environment.slug}` : null,
        }
      }),
  }
}

function sortLinks(links) {
  const rank = (name) => {
    const index = LINK_ORDER.indexOf(name)
    return index === -1 ? LINK_ORDER.length : index
  }
  return [...links.entries()]
    .sort(([first], [second]) => rank(first) - rank(second) || first.localeCompare(second))
    .map(([name, url]) => ({ name, url }))
}

export function publicUrl(label, routerPort) {
  return `http://${label}.${DOMAIN}${routerPort === 80 ? "" : `:${routerPort}`}`
}

/** Host header without its port, lowercased. */
export function hostname(hostHeader = "") {
  return hostHeader.replace(/:\d+$/u, "").toLowerCase()
}

/**
 * What answers a request for `host` that no running service took: the environment and the link
 * it belongs to, or a guess of the worktree name for a host no environment declares.
 */
export function describeHost(state, host) {
  for (const environment of state.environments) {
    const link = environment.links.find(
      (candidate) => hostname(new URL(candidate.url).host) === host,
    )
    if (link) return { environment, link, service: LINK_SERVICES[link.name] ?? link.name }
  }
  const label = host.endsWith(`.${DOMAIN}`) ? host.slice(0, -(DOMAIN.length + 1)) : host
  const shared = Object.entries(SHARED_LINKS).find(([, [sharedHost]]) => sharedHost === label)
  if (shared) return { environment: null, shared: SHARED_SERVICES[shared[0]] }
  const guess = label.replace(/-(embed-storybook|storybook|ui|embed|help|grafana|dex)$/u, "")
  return { environment: null, guess }
}
