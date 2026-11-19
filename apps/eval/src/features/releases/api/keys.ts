export const releaseKeys = {
  all: ["releases"] as const,
  published: () => [...releaseKeys.all, "published"] as const,
}
