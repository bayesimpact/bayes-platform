/** A mean rating with two decimals in the person's language, or a dash when there is none. */
export function meanRatingOf(rating: number | null, locale: string): string {
  if (rating === null) return "—"
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rating)
}
