import type { AppGrantablePermission } from "@caseai-connect/api-contracts"

export type AppInstallProject = {
  id: string
  name: string
  organizationId: string
  organizationName: string
}

export type AppInstallPage = {
  app: {
    id: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    grantablePermissions: AppGrantablePermission[]
  }
  projects: AppInstallProject[]
}

export type AuthorizeAppInstallInput = {
  slug: string
  projectId: string
  permissions: AppGrantablePermission[]
  redirectUri: string
  state: string
}

export type AuthorizeAppInstallResult = {
  clientId: string
  clientSecret: string
  redirectUri: string
  state: string
}
