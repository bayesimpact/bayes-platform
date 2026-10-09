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
    allowedRedirectUris: string[]
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
  code: string
  redirectUri: string
  state: string
}

export type ProjectAppInstallation = {
  id: string
  appName: string
  description: string | null
  logoUrl: string | null
  permissions: string[]
  clientId: string | null
  createdAt: number
}
