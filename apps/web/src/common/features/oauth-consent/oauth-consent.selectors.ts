import type { RootState } from "@/common/store"

export const selectOAuthConsentSearch = (state: RootState) => state.oauthConsent.search
export const selectOAuthConsentRequest = (state: RootState) => state.oauthConsent.request
export const selectOAuthConsentPage = (state: RootState) => state.oauthConsent.page
