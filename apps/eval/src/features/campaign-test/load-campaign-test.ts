import type {
  CampaignSessionParamsDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { loaderStaleTime } from "@caseai-connect/frontend-lib"
import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { loadConversation } from "@/features/conversation"
import { orNotFound } from "@/lib/not-found"
import { testerSessionsQueryOptions, testerSurveyQueryOptions } from "./api/queries"

/** Loads the tester's sessions and their final survey, in parallel. */
export async function loadTesterCampaign(
  queryClient: QueryClient,
  campaign: ReviewCampaignParamsDto,
) {
  await orNotFound(() =>
    Promise.all([
      queryClient.query({ ...testerSessionsQueryOptions(campaign), staleTime: loaderStaleTime }),
      queryClient.query({ ...testerSurveyQueryOptions(campaign), staleTime: loaderStaleTime }),
    ]),
  )
}

/** Loads the tester's final survey alone, for its page. */
export async function loadTesterSurvey(
  queryClient: QueryClient,
  campaign: ReviewCampaignParamsDto,
) {
  await orNotFound(() =>
    queryClient.query({ ...testerSurveyQueryOptions(campaign), staleTime: loaderStaleTime }),
  )
}

/**
 * Loads a tester's session: their sessions, to find it among them, and its messages. A session
 * that is not theirs is not found.
 */
export async function loadTesterSession(
  queryClient: QueryClient,
  session: CampaignSessionParamsDto,
  agentId: string,
) {
  const sessions = await orNotFound(() =>
    queryClient.query({ ...testerSessionsQueryOptions(session), staleTime: loaderStaleTime }),
  )
  if (!sessions.some((candidate) => candidate.id === session.sessionId)) throw notFound()
  await loadConversation(queryClient, {
    organizationId: session.organizationId,
    projectId: session.projectId,
    agentId,
    agentSessionId: session.sessionId,
  })
}
