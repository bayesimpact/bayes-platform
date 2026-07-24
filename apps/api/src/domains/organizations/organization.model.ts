import type { OrganizationPermission, TimeType } from "@caseai-connect/api-contracts"

export type OrganizationModel = {
  id: string
  name: string
  permissions: OrganizationPermission[]
  createdAt: TimeType
}
