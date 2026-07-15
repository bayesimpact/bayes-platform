export type OrganizationProjectModel = {
  id: string
  name: string
  featureFlags: string[]
}

export type OrganizationModel = {
  id: string
  name: string
  permissions: string[]
  projects: OrganizationProjectModel[]
}
