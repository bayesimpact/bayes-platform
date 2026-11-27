import { createApiClient } from "@caseai-connect/api-client"
import { claimAutomaticSignIn, endSession, getAccessToken, signIn } from "@/lib/auth/session"

/**
 * The client of the app's endpoints, on the app's session. `@caseai-connect/api-client` builds each
 * request from the route's schemas, parses each response, refreshes the token once after a 401 and
 * then starts a new sign-in. This is the only place the app calls `fetch` for the API.
 */
export const { apiRequest, apiStreamResponse } = createApiClient({
  getAccessToken,
  claimAutomaticSignIn,
  endSession,
  signIn,
})

export {
  ApiError,
  ContractMismatchError,
  readServerSentEvents,
  shouldRetryQuery,
} from "@caseai-connect/api-client"
