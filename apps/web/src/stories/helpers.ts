export function sortRecentlyCreated<T extends { createdAt: number }>(a: T, b: T) {
  return b.createdAt - a.createdAt
}
