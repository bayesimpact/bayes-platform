import type {
  AppInstallPage,
  AuthorizeAppInstallInput,
  AuthorizeAppInstallResult,
} from "./app-install.models"

export interface IAppInstallSpi {
  getInstallPage: (slug: string) => Promise<AppInstallPage>
  authorize: (input: AuthorizeAppInstallInput) => Promise<AuthorizeAppInstallResult>
}
