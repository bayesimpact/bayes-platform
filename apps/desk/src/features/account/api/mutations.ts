import {
  type AcceptTermsInputDto,
  DeskAccountRoutes,
  type UpdateMeInputDto,
} from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { meQueryOptions } from "./queries"

/** Accepts the current terms, then loads the person again, whom the Desk then opens to. */
export function useAcceptTerms() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AcceptTermsInputDto) => apiRequest(DeskAccountRoutes.acceptTerms, { body }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: meQueryOptions().queryKey }),
  })
}

/** Renames the person, who sees their new name at once in their menu. */
export function useUpdateName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateMeInputDto) => apiRequest(DeskAccountRoutes.patchMe, { body }),
    // The form sends the name its schema trimmed: the menu shows it as the API keeps it.
    onSuccess: (_, { name }) => {
      queryClient.setQueryData(meQueryOptions().queryKey, (me) =>
        me ? { ...me, user: { ...me.user, name } } : me,
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: meQueryOptions().queryKey }),
  })
}
