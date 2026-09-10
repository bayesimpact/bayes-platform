/**
 * Compile-time type equality, used to pin public copies of shared types.
 * `Equals<A, B>` is `true` only when the two types are identical for the checker
 * (the generic-function trick), so a widened union, an added optional field or an
 * optional field made required all resolve to `false`.
 */
export type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/** Fails to compile unless `T` is `true`. */
export type Assert<T extends true> = T
