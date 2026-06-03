import type { Me } from "./me.models"

export interface IMeSpi {
  getMe: () => Promise<Me>
  updateMe: (params: { name: string }) => Promise<void>
  acceptTerms: (params: { aiUsagePolicyAccepted: boolean }) => Promise<void>
}
