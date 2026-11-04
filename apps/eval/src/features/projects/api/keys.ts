export const projectKeys = {
  all: ["projects"] as const,
  evaluation: () => [...projectKeys.all, "evaluation"] as const,
}
