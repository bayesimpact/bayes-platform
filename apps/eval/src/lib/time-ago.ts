import { formatDistanceStrict, type Locale } from "date-fns"
import { enUS, fr } from "date-fns/locale"

/** The date-fns locale of each language of the app; English for any other. */
const DATE_FNS_LOCALES: Record<string, Locale> = { en: enUS, fr }

/**
 * How long ago a moment was, in the person's language: "5 minutes ago", "3 days ago", "il y a 2
 * heures". Under a minute, it counts seconds. A moment after `now`, as a clock that is a little
 * off gives, reads as now.
 */
export function timeAgoOf(moment: number, now: number, locale: string): string {
  return formatDistanceStrict(Math.min(moment, now), now, {
    addSuffix: true,
    locale: DATE_FNS_LOCALES[locale] ?? enUS,
  })
}
