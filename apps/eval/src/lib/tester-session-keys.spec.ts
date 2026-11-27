import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { invalidateTesterSession, TESTER_SESSIONS_QUERY_KEY } from "./tester-session-keys"

describe("invalidateTesterSession", () => {
  it("refreshes the lists that hold the session, and no other query", () => {
    const sessionId = crypto.randomUUID()
    const holdingKey = [...TESTER_SESSIONS_QUERY_KEY, crypto.randomUUID()]
    const otherCampaignKey = [...TESTER_SESSIONS_QUERY_KEY, crypto.randomUUID()]
    const otherRootKey = ["review-campaigns", crypto.randomUUID(), "sessions"]
    const queryClient = new QueryClient()
    queryClient.setQueryData(holdingKey, [{ id: crypto.randomUUID() }, { id: sessionId }])
    queryClient.setQueryData(otherCampaignKey, [{ id: crypto.randomUUID() }])
    // A list of another root that holds the session too: it is not the tester's.
    queryClient.setQueryData(otherRootKey, [{ id: sessionId }])

    invalidateTesterSession(queryClient, sessionId)

    const isInvalidated = (queryKey: string[]) => queryClient.getQueryState(queryKey)?.isInvalidated
    expect([holdingKey, otherCampaignKey, otherRootKey].map(isInvalidated)).toEqual([
      true,
      false,
      false,
    ])
  })
})
