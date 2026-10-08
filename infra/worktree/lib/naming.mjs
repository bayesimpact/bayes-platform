// Names of a worktree environment, derived from the worktree folder name (its "slug"): compose
// project, databases, hostnames, Phoenix project. Pure functions only.

export const DOMAIN = "connect.localhost"
export const MAX_SLUG_LENGTH = 32

// Hostnames of the shared stack, and the suffixes of the services of an environment: a slug
// ending like one of them would take another environment's hostname.
const RESERVED_SLUGS = new Set([
  "api",
  "connect",
  "dashboard",
  "dev",
  "grafana",
  "mail",
  "main",
  "phoenix",
  "router",
  "traefik",
  "www",
])
const SERVICE_SUFFIXES = ["-dex", "-grafana", "-embed", "-help", "-storybook", "-ui"]

/** Why a worktree folder name cannot name an environment, or null when it can. */
export function slugProblem(slug) {
  if (slug.startsWith("agent-")) {
    return "agent worktrees (agent-*) are short-lived and never get an environment"
  }
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/u.test(slug)) {
    return "use lowercase letters, digits and single hyphens, starting with a letter (for example fix-sidebar)"
  }
  if (slug.length > MAX_SLUG_LENGTH) return `use at most ${MAX_SLUG_LENGTH} characters`
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is a hostname of the shared stack`
  const suffix = SERVICE_SUFFIXES.find((candidate) => slug.endsWith(candidate))
  if (suffix) return `a name ending with "${suffix}" would take another environment's hostname`
  return null
}

export function originOf(label, routerPort) {
  return `http://${label}.${DOMAIN}${Number(routerPort) === 80 ? "" : `:${routerPort}`}`
}

export function environmentNames(slug, routerPort) {
  const database = `connect_wt_${slug.replaceAll("-", "_")}`
  const origin = originOf(slug, routerPort)
  return {
    slug,
    project: `wt-${slug}`,
    database,
    testDatabase: `${database}__test`,
    phoenixProject: `wt-${slug}`,
    origin,
    embedOrigin: originOf(`${slug}-embed`, routerPort),
    helpOrigin: originOf(`${slug}-help`, routerPort),
    dexIssuer: `${originOf(`${slug}-dex`, routerPort)}/dex`,
    links: [
      ["App", origin],
      ["Bull Board", `${origin}/api/internal/bull-board`],
      ["Grafana", originOf(`${slug}-grafana`, routerPort)],
      ["Storybook", originOf(`${slug}-storybook`, routerPort)],
      ["UI Storybook", originOf(`${slug}-ui`, routerPort)],
      ["Embed", originOf(`${slug}-embed`, routerPort)],
      ["Embed Storybook", originOf(`${slug}-embed-storybook`, routerPort)],
      ["Help", originOf(`${slug}-help`, routerPort)],
      ["Traces", `${originOf("phoenix", routerPort)}/redirects/projects/wt-${slug}`],
      ["Emails", originOf("mail", routerPort)],
    ],
  }
}

/**
 * Whether a database belongs to the environment of `slug`: its copy, its test database, the
 * per-worker test databases of test:parallel, or a copy being restored. Never connect or
 * connect_test*: every drop goes through this check.
 */
export function isDatabaseOf(slug, name) {
  const base = `connect_wt_${slug.replaceAll("-", "_")}`
  return (
    name === base ||
    name === `${base}__restoring` ||
    name === `${base}__test` ||
    new RegExp(`^${base}__test_w\\d+$`, "u").test(name)
  )
}

/** The folders with a nested node_modules in package-lock.json, root first. */
export function nodeModulesFolders(packageLock) {
  const folders = new Set()
  for (const key of Object.keys(packageLock.packages ?? {})) {
    const index = key.indexOf("/node_modules/")
    if (key.startsWith("node_modules/")) folders.add("")
    else if (index > 0) folders.add(key.slice(0, index))
  }
  return [...folders].sort((first, second) => first.localeCompare(second))
}
