import { USER_TYPE_HUMAN, USER_TYPE_SERVICE, type UserType } from "./user.types"

export const SERVICE_USER_EMAIL_DOMAIN = "service.bayes.internal"
export const SERVICE_USER_AUTH0_ID_PREFIX = "service|"

export function buildServiceUserEmail(appSlug: string, installationId: string): string {
  return `${appSlug.trim().toLowerCase()}+${installationId}@${SERVICE_USER_EMAIL_DOMAIN}`
}

export function buildServiceUserAuth0Id(installationId: string): string {
  return `${SERVICE_USER_AUTH0_ID_PREFIX}${installationId}`
}

export function isServiceAuth0Id(auth0Id: string): boolean {
  return auth0Id.startsWith(SERVICE_USER_AUTH0_ID_PREFIX)
}

export function isServiceUserEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${SERVICE_USER_EMAIL_DOMAIN}`)
}

export function isServiceUser(user: { type: UserType }): boolean {
  return user.type === USER_TYPE_SERVICE
}

export function isUninvitableServiceIdentity(params: {
  email: string
  user?: { type: UserType } | null
}): boolean {
  if (isServiceUserEmail(params.email)) return true
  return params.user != null && isServiceUser(params.user)
}

export const HUMAN_USER_TYPE_FILTER = { type: USER_TYPE_HUMAN } as const
