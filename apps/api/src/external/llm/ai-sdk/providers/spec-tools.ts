export const includesInsensitive = (stringValue: string, searchString: string): boolean => {
  return stringValue.toLowerCase().includes(searchString.toLowerCase())
}

export const expectIncludes = (stringValue: string, searchString: string): boolean => {
  if (includesInsensitive(stringValue, searchString)) return true
  expect(`"${stringValue}"`).toBe(` should includes "${searchString}"`)
  return false
}
export const expectIncludesAtLeastOne = (stringValue: string, searchStrings: string[]): boolean => {
  if (searchStrings.some((v) => includesInsensitive(stringValue, v))) return true
  expect(`"${stringValue}"`).toBe(
    ` should includes : ${searchStrings.map((v) => `"${v}"`).join(" or ")}`,
  )
  return false
}
