/** The start of an id, enough to tell two sessions or two people apart on screen. */
export function shortIdOf(id: string): string {
  return id.slice(0, 8)
}
