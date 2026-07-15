import type { OrganizationListItem } from "./organizations.models"

export interface IOrganizationsSpi {
  list: () => Promise<OrganizationListItem[]>
  createOne: (payload: { name: string }) => Promise<{ id: string }>
  updateOne: (params: { organizationId: string }, payload: { name: string }) => Promise<void>
}
