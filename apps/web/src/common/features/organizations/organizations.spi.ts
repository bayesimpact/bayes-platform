import type { Organization } from "./organizations.models"

export interface IOrganizationsSpi {
  list: () => Promise<Organization[]>
  createOne: (payload: { name: string }) => Promise<{ id: string }>
  updateOne: (params: { organizationId: string }, payload: { name: string }) => Promise<void>
}
