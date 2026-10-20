import { DeskAccountRoutes } from "@caseai-connect/desk-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { accountKeys } from "./keys"

/** The signed-in person and the projects where they hold `desk.ui.read` (`GET desk/me`). */
export const meQueryOptions = () =>
  queryOptions({
    queryKey: accountKeys.me(),
    queryFn: ({ signal }) => apiRequest(DeskAccountRoutes.getMe, { signal }),
  })
