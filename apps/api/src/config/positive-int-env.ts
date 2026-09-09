const POSITIVE_INT_PATTERN = /^\d+$/

export type PositiveIntEnvOptions = {
  /** Returned when the variable is unset or empty. Without it, an unset variable throws. */
  defaultValue?: number
  /** Appended to error messages, e.g. "seconds" gives "must be a positive integer (seconds)". */
  unitWord?: string
}

/**
 * Reads a positive integer from the environment the way the Go services do
 * (`strconv.Atoi`): only ASCII digits are accepted, so "15m" or "1.5" fail
 * instead of silently truncating to 15 or 1. An unset or empty variable falls
 * back to `defaultValue` when one is given and throws otherwise.
 */
export function readPositiveIntEnv(
  environmentVariableName: string,
  options: PositiveIntEnvOptions = {},
): number {
  const { defaultValue, unitWord } = options
  const unitSuffix = unitWord === undefined ? "" : ` (${unitWord})`
  const rawValue = process.env[environmentVariableName]

  if (rawValue === undefined || rawValue === "") {
    if (defaultValue === undefined) {
      throw new Error(`${environmentVariableName} must be set to a positive integer${unitSuffix}.`)
    }
    return defaultValue
  }

  if (!POSITIVE_INT_PATTERN.test(rawValue)) {
    throw new Error(`${environmentVariableName} must be a positive integer${unitSuffix}.`)
  }
  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${environmentVariableName} must be a positive integer${unitSuffix}.`)
  }
  return parsed
}
