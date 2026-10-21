import { DeskAccountRoutes } from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { accountKeys } from "./keys"

/** Accepts the current terms, then loads the person again, whom the Desk then opens to. */
export function useAcceptTerms() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (aiUsagePolicyAccepted: boolean) =>
      apiRequest(DeskAccountRoutes.acceptTerms, { body: { aiUsagePolicyAccepted } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.me() }),
  })
}
