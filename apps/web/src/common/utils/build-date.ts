import type { TimeType } from "@caseai-connect/api-contracts"
import {
  type FormatOptions,
  format,
  formatDistanceToNow,
  formatDuration,
  intervalToDuration,
} from "date-fns"
import { getLocale } from "./get-locale"

export function buildDate(
  date: TimeType,
  formatStr: string = "dd MMMM yyyy HH:mm",
  formatOptions?: FormatOptions,
) {
  return format(new Date(date), formatStr, { locale: getLocale(), ...formatOptions })
}

export function buildSince(date: TimeType) {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: getLocale(),
  })
}

export function buildDuration(start: TimeType, end: TimeType) {
  const duration = intervalToDuration({ start: new Date(start), end: new Date(end) })
  return formatDuration(duration, {
    locale: getLocale(),
    format: ["days", "hours", "minutes", "seconds"],
    zero: false,
  })
}
