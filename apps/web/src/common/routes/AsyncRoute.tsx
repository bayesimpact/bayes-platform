import type { ReactNode } from "react"
import type { AsyncData } from "@/common/store/async-data-status"
import { ADS } from "@/common/store/async-data-status"
import { ErrorRoute } from "./ErrorRoute"
import { LoadingRoute } from "./LoadingRoute"

export function AsyncRoute<T extends readonly AsyncData<unknown>[]>({
  data,
  children,
}: {
  data: [...T]
  children: ReactNode
}): ReactNode {
  const errorItem = data.find((item) => ADS.isError(item))
  if (errorItem) {
    return <ErrorRoute error={errorItem.error || "Unknown error"} />
  }

  if (data.every((item) => ADS.isFulfilled(item))) {
    return children
  }

  return <LoadingRoute />
}
