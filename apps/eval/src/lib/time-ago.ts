import { type Locale as DateFnsLocale, formatDistanceStrict } from "date-fns"
import { de, enUS, es, fr, it, pl } from "date-fns/locale"
import type { Locale } from "@/app/i18n"
import { hasOwnKey } from "./has-own-key"

/** The date-fns locale of each language of the app; English for any other. */
const DATE_FNS_LOCALES = { en: enUS, fr, de, it, es, pl } satisfies Record<Locale, DateFnsLocale>

/**
 * How long ago a moment was, in the person's language: "5 minutes ago", "3 days ago", "il y a 2
 * heures". Under a minute, it counts seconds. A moment after `now`, as a clock that is a little
 * off gives, reads as now.
 */
export function timeAgoOf(moment: number, now: number, locale: string): string {
  return formatDistanceStrict(Math.min(moment, now), now, {
    addSuffix: true,
    locale: hasOwnKey(DATE_FNS_LOCALES, locale) ? DATE_FNS_LOCALES[locale] : enUS,
  })
}
