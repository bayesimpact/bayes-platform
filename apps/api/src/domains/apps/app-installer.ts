import type { AppInstallerDto } from "@caseai-connect/api-contracts"
import type { ResolvedAppInstaller } from "./app-installation.repository"

/**
 * Who installed an app, as `viewerUserId` sees them. An installer who can no longer install apps
 * on the project reads as a former member, whether they left it, lost the permission, or have no
 * account any more: nobody is left to ask, and someone else may reconnect the app.
 */
export function toAppInstallerDto(
  installer: ResolvedAppInstaller,
  viewerUserId: string,
): AppInstallerDto {
  if (installer.user && installer.createdByUserId === viewerUserId) return { kind: "me" }
  if (!installer.user || !installer.canStillInstall) return { kind: "former-member" }
  return { kind: "member", name: installer.user.name, email: installer.user.email }
}
