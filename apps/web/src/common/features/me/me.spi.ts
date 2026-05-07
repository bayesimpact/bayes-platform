import type { Me } from "./me.models"

export interface IMeSpi {
  getMe: () => Promise<Me>
  acceptTerms: (params: { aiUsagePolicyAccepted: boolean }) => Promise<void>
}
