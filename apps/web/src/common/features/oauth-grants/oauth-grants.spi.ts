import type { OAuthGrant } from "./oauth-grants.models"

export interface IOAuthGrantsSpi {
  getAll: () => Promise<OAuthGrant[]>
  deleteOne: (grantId: string) => Promise<void>
}
