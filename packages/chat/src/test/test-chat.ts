import { createApiClient, readServerSentEvents } from "@caseai-connect/api-client"
import { conversationRoutesAt, documentsRoutesAt } from "@caseai-connect/chat-contracts"
import { QueryClient } from "@tanstack/react-query"
import type { ChatOptions } from "../api/chat-options"
import { createChat } from "../api/create-chat"

const PROJECT_PATH = "test/organizations/:organizationId/projects/:projectId"

/** The routes of the test chat: the Desk's kind of session, under a path of the package's own. */
export const testRoutes = {
  conversation: conversationRoutesAt(PROJECT_PATH, "live"),
  documents: documentsRoutesAt(PROJECT_PATH),
}

/** The real API client (the test kit is the one place the package imports it at run time), on a session that always has a token and never signs in again. */
const testApi = {
  ...createApiClient({
    getAccessToken: async () => "test-token",
    claimAutomaticSignIn: () => false,
    endSession: async () => {},
    signIn: async () => {},
  }),
  readServerSentEvents,
}

/** A chat on the test routes and the real client, which the specs answer with `mockRoute`. */
export function createTestChat(overrides: Partial<ChatOptions> = {}) {
  return createChat({ routes: testRoutes, api: testApi, ...overrides })
}

/** A query client that never retries, so a failing route fails the spec at once. */
export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}
