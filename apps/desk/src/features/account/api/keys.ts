export const accountKeys = {
  all: ["account"] as const,
  me: () => [...accountKeys.all, "me"] as const,
}
