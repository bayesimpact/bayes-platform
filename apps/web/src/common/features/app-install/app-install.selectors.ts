import { isHttpRedirectUri } from "@caseai-connect/api-contracts"
import type { RootState } from "@/common/store"

export const selectAppInstallPage = (state: RootState) => state.appInstall.page
export const selectAppInstallSlug = (state: RootState) => state.appInstall.slug
export const selectAppInstallRedirectUri = (state: RootState) => state.appInstall.redirectUri
export const selectAppInstallCallbackState = (state: RootState) => state.appInstall.callbackState

export const selectProjectInstallations = (state: RootState) =>
  state.appInstall.projectInstallations

/** Query params present and syntactically valid before the install page loads. */
export const selectAppInstallHasValidCallbackParams = (state: RootState): boolean =>
  isHttpRedirectUri(state.appInstall.redirectUri) && state.appInstall.callbackState.length > 0
