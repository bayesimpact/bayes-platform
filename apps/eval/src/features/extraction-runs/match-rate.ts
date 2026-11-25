import type { ExtractionRunOutputDto } from "@bayes-platform/eval-contracts"

/**
 * The share of a run's records that match on every scored field, from 0 to 1: none before the
 * run asked a record.
 */
export function matchRateOf(summary: ExtractionRunOutputDto["summary"]): number | null {
  if (!summary || summary.total === 0) return null
  return summary.perfectMatches / summary.total
}

/** A share as a whole percentage, such as 75 %. */
export const percentOf = (share: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(share)
