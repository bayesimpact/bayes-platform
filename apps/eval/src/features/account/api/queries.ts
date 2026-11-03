import { EvalAccountRoutes } from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { accountKeys } from "./keys"

/** The signed-in person (`GET me`). */
export const meQueryOptions = () =>
  queryOptions({
    queryKey: accountKeys.me(),
    queryFn: ({ signal }) => apiRequest(EvalAccountRoutes.getMe, { signal }),
  })
