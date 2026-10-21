/** The unit a past moment reads in, and how many of it make the next one. */
const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "minute", seconds: 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "week", seconds: 7 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
]

/**
 * How long ago a moment was, in the person's language: "5 minutes ago", "yesterday". `null`
 * under a minute, which the caller words itself ("just now").
 */
export function relativeTimeOf(moment: number, now: number, locale: string): string | null {
  const elapsedSeconds = Math.max(0, (now - moment) / 1000)
  if (elapsedSeconds < 60) return null
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const unit = [...UNITS].reverse().find((candidate) => elapsedSeconds >= candidate.seconds)
  const { unit: name, seconds } = unit ?? { unit: "minute", seconds: 60 }
  return format.format(-Math.floor(elapsedSeconds / seconds), name)
}

/** The full date and time of a moment, in the person's language: "Oct 21, 2026, 3:01 PM". */
export function fullDateTimeOf(moment: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(moment)
}
