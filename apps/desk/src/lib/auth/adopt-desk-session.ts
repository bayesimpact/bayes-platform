import { appStorePrefix, sessionStorageKey } from "@caseai-connect/sign-in"

/**
 * The Desk kept a session of its own under `desk.oidc.` until every app shared one. That session
 * becomes the shared one when there is none yet, and is forgotten either way: its refresh token
 * would otherwise stay in the browser, unused.
 */
export function adoptDeskSession(
  settings: Parameters<typeof sessionStorageKey>[0],
  store: Storage = window.localStorage,
): void {
  const sharedKey = sessionStorageKey(settings)
  const deskKey = `${appStorePrefix("desk")}user:${settings.authority}:${settings.client_id}`
  const deskSession = store.getItem(deskKey)
  if (deskSession === null) return
  if (store.getItem(sharedKey) === null) store.setItem(sharedKey, deskSession)
  store.removeItem(deskKey)
}
