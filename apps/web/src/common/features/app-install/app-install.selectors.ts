import { isLoopbackRedirectUri } from "@caseai-connect/api-contracts"
import type { RootState } from "@/common/store"

export const selectAppInstallPage = (state: RootState) => state.appInstall.page
export const selectAppInstallSlug = (state: RootState) => state.appInstall.slug
export const selectAppInstallRedirectUri = (state: RootState) => state.appInstall.redirectUri
export const selectAppInstallCallbackState = (state: RootState) => state.appInstall.callbackState

export const selectAppInstallHasValidLoopback = (state: RootState): boolean =>
  isLoopbackRedirectUri(state.appInstall.redirectUri) && state.appInstall.callbackState.length > 0
