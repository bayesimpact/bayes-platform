import type {
  AppInstallPage,
  AuthorizeAppInstallInput,
  AuthorizeAppInstallResult,
  ProjectAppInstallation,
} from "./app-install.models"

export interface IAppInstallSpi {
  getInstallPage: (slug: string) => Promise<AppInstallPage>
  authorize: (input: AuthorizeAppInstallInput) => Promise<AuthorizeAppInstallResult>
  listForProject: (projectId: string) => Promise<ProjectAppInstallation[]>
  revoke: (installationId: string) => Promise<void>
}
