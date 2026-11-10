import type { AppInstallerDto } from "@caseai-connect/api-contracts"
import type { AppInstallationInstaller } from "./app-installation.repository"

/** Who installed an app, as `viewerUserId` sees them. */
export function toAppInstallerDto(
  installer: AppInstallationInstaller,
  viewerUserId: string,
): AppInstallerDto {
  if (!installer.user) return { kind: "former-member" }
  if (installer.createdByUserId === viewerUserId) return { kind: "me" }
  return { kind: "member", name: installer.user.name, email: installer.user.email }
}
