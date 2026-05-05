import type { Me, PendingInvitations } from "./me.models"

export interface IMeSpi {
  getMe: () => Promise<Me>
  getPendingInvitations: () => Promise<PendingInvitations>
  acceptTerms: (params: { aiUsagePolicyAccepted: boolean }) => Promise<void>
}
