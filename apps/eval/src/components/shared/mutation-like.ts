/**
 * What a shared component needs of a mutation of TanStack Query, which a feature owns: the call,
 * with what to do once it ends, and whether it runs.
 */
export type MutationLike<TVariables> = {
  mutate: (
    variables: TVariables,
    options?: { onSuccess?: () => void; onError?: () => void },
  ) => void
  isPending: boolean
}
