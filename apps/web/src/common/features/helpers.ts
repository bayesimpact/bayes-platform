import type { RootState } from "@/common/store/types"
import { assert } from "../utils/assert"

export function getCurrentId({ state, name }: { state: RootState; name: string }): string {
  if (!name.endsWith("Id")) {
    throw new Error(`Invalid ID name: ${name}. Expected to end with 'Id'.`)
  }
  const currentIds = state.currentIds
  const value = currentIds[name as keyof typeof currentIds]
  assert(value, `No current ${name} found.`)
  return value
}
