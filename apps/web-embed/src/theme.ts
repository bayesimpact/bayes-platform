/** The widget's colour when an agent's embed settings and the launcher's data-color leave it
 *  unset: the Bayes Platform's black, rather than a generic blue. It paints the header, the
 *  user's messages, the send button and the launcher button. */
export const DEFAULT_PRIMARY_COLOR = "#000000"

/** Text on a light primary colour (a beige or white header). */
export const INK = "#1b1f24"
const WHITE = "#ffffff"

function rgb(color: string): [number, number, number] | null {
  const hex = color.trim().replace(/^#/, "")
  const full = /^[0-9a-f]{3}$/i.test(hex) ? hex.replace(/./g, "$&$&") : hex
  if (/^[0-9a-f]{6}$/i.test(full)) {
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ]
  }
  const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** The colours derived from a primary colour, so that a light one (a beige header) stays
 *  readable: `onPrimary` is the text on it, `accent` the colour of what must stand out on the
 *  white chat (the send button, the suggested questions), which falls back to ink when the
 *  primary is too pale, and `onAccent` the text on that. An unparsable colour keeps white text. */
export function themeColors(primary: string = DEFAULT_PRIMARY_COLOR) {
  const parsed = rgb(primary)
  if (!parsed) return { primary, onPrimary: WHITE, accent: primary, onAccent: WHITE }
  const l = luminance(parsed)
  const white = luminance([255, 255, 255])
  const ink = luminance(rgb(INK) as [number, number, number])
  const onPrimary = contrast(l, ink) > contrast(l, white) ? INK : WHITE
  const accent = contrast(l, white) < 3 ? INK : primary
  const onAccent = accent === INK ? WHITE : onPrimary
  return { primary, onPrimary, accent, onAccent }
}

/** The CSS custom properties the chat components read. */
export function themeVars(primary?: string | null): Record<string, string> {
  const c = themeColors(primary ?? DEFAULT_PRIMARY_COLOR)
  return {
    "--embed-primary": c.primary,
    "--embed-on-primary": c.onPrimary,
    "--embed-accent": c.accent,
    "--embed-on-accent": c.onAccent,
  }
}
