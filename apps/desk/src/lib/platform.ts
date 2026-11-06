/**
 * Whether the person uses an Apple system, whose shortcuts take Command where the others take
 * Control. The browsers still fill `navigator.platform`, which the user agent backs up.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}
