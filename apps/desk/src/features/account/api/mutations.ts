import { DeskAccountRoutes, type MeOutputDto } from "@caseai-connect/desk-contracts"
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

/** Renames the person, who sees their new name at once in their menu. */
export function useUpdateName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => apiRequest(DeskAccountRoutes.patchMe, { body: { name } }),
    onSuccess: (_, name) => {
      queryClient.setQueryData<MeOutputDto>(accountKeys.me(), (me) =>
        me ? { ...me, user: { ...me.user, name: name.trim() } } : me,
      )
      void queryClient.invalidateQueries({ queryKey: accountKeys.me() })
    },
  })
}
