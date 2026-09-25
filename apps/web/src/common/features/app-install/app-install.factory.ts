import type { AppGrantablePermission } from "@caseai-connect/api-contracts"
import { faker } from "@faker-js/faker"
import { Factory } from "fishery"
import type {
  AppInstallPage,
  AppInstallProject,
  ProjectAppInstallation,
} from "./app-install.models"

class AppInstallProjectFactory extends Factory<AppInstallProject> {}

export const appInstallProjectFactory = AppInstallProjectFactory.define(({ params, sequence }) => ({
  id: params.id ?? faker.string.uuid(),
  name: params.name ?? `Workspace ${sequence}`,
  organizationId: params.organizationId ?? faker.string.uuid(),
  organizationName: params.organizationName ?? "Acme",
}))

class AppInstallPageFactory extends Factory<AppInstallPage> {}

export const appInstallPageFactory = AppInstallPageFactory.define(({ params }) => {
  const grantablePermissions: AppGrantablePermission[] = params.app?.grantablePermissions ?? [
    "document.read",
    "document.create",
    "project.read",
  ]
  return {
    app: {
      id: params.app?.id ?? faker.string.uuid(),
      name: params.app?.name ?? "Helpful Assistant",
      slug: params.app?.slug ?? "helpful-assistant",
      description: params.app?.description ?? "A generic assistant used in tests.",
      logoUrl: params.app?.logoUrl ?? null,
      grantablePermissions,
    },
    projects: params.projects ?? appInstallProjectFactory.buildList(2),
  }
})

class ProjectAppInstallationFactory extends Factory<ProjectAppInstallation> {}

export const projectAppInstallationFactory = ProjectAppInstallationFactory.define(
  ({ params, sequence }) => ({
    id: params.id ?? faker.string.uuid(),
    appName: params.appName ?? `Helpful Assistant ${sequence}`,
    description: params.description ?? "A generic assistant used in tests.",
    logoUrl: params.logoUrl ?? null,
    permissions: params.permissions ?? ["document.read"],
    clientId: params.clientId ?? faker.string.uuid(),
    createdAt: params.createdAt ?? Date.now(),
  }),
)
