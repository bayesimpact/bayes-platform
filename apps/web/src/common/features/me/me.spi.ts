import type { Me, User } from "./me.models"

export interface IMeSpi {
  getMe: () => Promise<Me>
  updateMe: (params: { name: string }) => Promise<User>
  acceptTerms: (params: { aiUsagePolicyAccepted: boolean }) => Promise<void>
}
