import { EvalAccountRoutes, TRACE_READ_PERMISSION } from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { accountKeys } from "./keys"

/** The signed-in person (`GET eval/me`). */
export const meQueryOptions = () =>
  queryOptions({
    queryKey: accountKeys.me(),
    queryFn: ({ signal }) => apiRequest(EvalAccountRoutes.getMe, { signal }),
  })

/**
 * Whether the signed-in person may open the trace of an agent's answer: a permission they hold
 * whatever the project, which few people have.
 */
export const canReadTracesQueryOptions = () =>
  queryOptions({
    ...meQueryOptions(),
    select: (me) => me.user.globalPermissions.includes(TRACE_READ_PERMISSION),
  })
