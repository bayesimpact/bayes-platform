export const projectKeys = {
  all: ["projects"] as const,
  mine: () => [...projectKeys.all, "mine"] as const,
  agents: (projectId: string) => [...projectKeys.all, projectId, "agents"] as const,
}

export const organizationKeys = {
  all: ["organizations"] as const,
  mine: () => [...organizationKeys.all, "mine"] as const,
}
