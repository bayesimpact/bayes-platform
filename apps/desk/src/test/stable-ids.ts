/**
 * Makes `crypto.randomUUID` count from the start again, so a mocked world gets the same ids on
 * every load and a story or a reload opens the same page. The ids stay valid version 4 UUIDs,
 * which the contracts check.
 */
export function installStableIds(): void {
  let next = 0
  crypto.randomUUID = () => {
    next += 1
    const suffix = next.toString(16).padStart(12, "0")
    // Safe: five dash-separated hex groups, the shape `randomUUID` returns.
    return `00000000-0000-4000-8000-${suffix}` as `${string}-${string}-${string}-${string}-${string}`
  }
}
