import type { RootState } from "@/common/store"

export const selectOAuthGrants = (state: RootState) => state.oauthGrants.grants
