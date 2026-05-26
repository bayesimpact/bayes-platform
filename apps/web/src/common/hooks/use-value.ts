import { ADS, type AsyncData } from "../store/async-data-status"
import { useAppSelector } from "../store/hooks"
import type { RootState } from "../store/types"
import { assert } from "../utils/assert"

export function useValue<T>(selector: (state: RootState) => AsyncData<T>): T {
  const data = useAppSelector(selector)
  if (ADS.isFulfilled(data)) return data.value
  throw new Error(`Value for ${selector.name || "selector"} is not available`)
}

export function useCurrentId(selector: (state: RootState) => string | null): string {
  const id = useAppSelector(selector)
  assert(id, `ID for ${selector.name || "selector"} is not available`)
  return id
}
