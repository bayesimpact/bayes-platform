export function readIntEnv(name: string, defaultValue: number): number {
  const rawValue = process.env[name]
  if (!rawValue) return defaultValue
  const parsed = Number.parseInt(rawValue, 10)
  return Number.isNaN(parsed) ? defaultValue : parsed
}
