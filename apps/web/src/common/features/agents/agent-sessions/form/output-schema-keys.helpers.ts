function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function walk(node: unknown, keys: Set<string>) {
  if (!isObject(node)) return
  if (isObject(node.properties)) {
    for (const key of Object.keys(node.properties)) keys.add(key)
  }
  walk(node.then, keys)
  walk(node.else, keys)
}

export function collectFormDisplayKeys(
  schema: unknown,
  result: Record<string, unknown> | null | undefined,
): string[] {
  const keys = new Set<string>()
  walk(schema, keys)
  if (result) {
    for (const key of Object.keys(result)) keys.add(key)
  }
  return [...keys]
}
