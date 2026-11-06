/**
 * The value, or a failure that names what is missing: a test stops where the cause is, rather than
 * carry an `undefined` further, such as into a URL.
 */
export function required<TValue>(value: TValue | null | undefined, description: string): TValue {
  if (value === undefined || value === null) throw new Error(`Missing: ${description}`)
  return value
}
