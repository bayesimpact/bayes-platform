import { isHttpRedirectUri } from "@caseai-connect/api-contracts"
import type { RootState } from "@/common/store"

export const selectAppInstallPage = (state: RootState) => state.appInstall.page
export const selectAppInstallSlug = (state: RootState) => state.appInstall.slug
export const selectAppInstallRedirectUri = (state: RootState) => state.appInstall.redirectUri
export const selectAppInstallCallbackState = (state: RootState) => state.appInstall.callbackState
export const selectAppInstallCodeChallenge = (state: RootState) => state.appInstall.codeChallenge
export const selectAppInstallCodeChallengeMethod = (state: RootState) =>
  state.appInstall.codeChallengeMethod

export const selectProjectInstallations = (state: RootState) =>
  state.appInstall.projectInstallations

const PKCE_VALUE = /^[A-Za-z0-9_-]{43,128}$/

/** Query params present and syntactically valid before the install page loads. */
export const selectAppInstallHasValidCallbackParams = (state: RootState): boolean =>
  isHttpRedirectUri(state.appInstall.redirectUri) &&
  state.appInstall.callbackState.length > 0 &&
  PKCE_VALUE.test(state.appInstall.codeChallenge) &&
  state.appInstall.codeChallengeMethod === "S256"
