import type { QueryClient } from "@tanstack/react-query"

/**
 * The root of the query keys of the tester's campaigns, and of their sessions. The campaign-test
 * feature builds its keys on them, and the chat invalidates a session's forms with them: the
 * conversation feature may not import the campaign-test one, which imports it.
 */
export const CAMPAIGN_TEST_QUERY_KEY = ["campaign-tests"] as const
export const TESTER_SESSIONS_QUERY_KEY = [...CAMPAIGN_TEST_QUERY_KEY, "sessions"] as const

/** Whether the data of a tester's sessions query holds the session. */
function holdsSession(data: unknown, sessionId: string): boolean {
  return (
    Array.isArray(data) &&
    data.some((session) => typeof session === "object" && session?.id === sessionId)
  )
}

/**
 * Loads again the sessions of the campaign a session belongs to, which carry its forms. The
 * conversation's params name no campaign: the sessions' queries that hold the session are the
 * ones to refresh, and no other campaign's.
 */
export function invalidateTesterSession(queryClient: QueryClient, sessionId: string): void {
  void queryClient.invalidateQueries({
    queryKey: TESTER_SESSIONS_QUERY_KEY,
    predicate: (query) => holdsSession(query.state.data, sessionId),
  })
}
