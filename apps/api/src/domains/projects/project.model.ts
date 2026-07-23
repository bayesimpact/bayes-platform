export type ProjectModel = {
  id: string
  organizationId: string
  name: string
  featureFlags: string[]
  permissions: string[]
}

export type ProjectOrganizationModel = {
  id: string
  name: string
  permissions: string[]
}
