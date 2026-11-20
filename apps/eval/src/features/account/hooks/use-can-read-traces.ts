import { TRACE_READ_PERMISSION } from "@caseai-connect/eval-contracts"
import { useSuspenseQuery } from "@tanstack/react-query"
import { meQueryOptions } from "../api/queries"

/**
 * Whether the signed-in person may open the trace of an agent's answer: a permission they hold
 * whatever the project, which few people have.
 */
export function useCanReadTraces(): boolean {
  const { data } = useSuspenseQuery({
    ...meQueryOptions(),
    select: (me) => me.user.globalPermissions.includes(TRACE_READ_PERMISSION),
  })
  return data
}
