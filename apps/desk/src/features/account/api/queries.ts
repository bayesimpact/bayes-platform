import { DeskAccountRoutes } from "@bayes-platform/desk-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { accountKeys } from "./keys"

/** The signed-in person (`GET desk/me`). */
export const meQueryOptions = () =>
  queryOptions({
    queryKey: accountKeys.me(),
    queryFn: ({ signal }) => apiRequest(DeskAccountRoutes.getMe, { signal }),
  })
