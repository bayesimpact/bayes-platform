import { useLingui } from "@lingui/react/macro"

export type CountProps = {
  /** The number to show: none shows a dash. */
  value: number | null | undefined
}

/** A number as the person's language writes it, in a cell or beside a label: a dash for none. */
export function Count({ value }: CountProps) {
  const { i18n } = useLingui()
  return value === null || value === undefined ? "–" : i18n.number(value)
}
