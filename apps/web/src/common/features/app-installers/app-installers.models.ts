import type { AppInstallerDto } from "@caseai-connect/api-contracts"

/**
 * Who installed an app on a workspace, as the person looking sees them. A former member can no
 * longer install apps there: they left the workspace, lost the permission, or have no account any
 * more. Nobody is left to ask, so someone else may reconnect the app and become its installer.
 *
 * A shared model with its labels: it has no slice or API of its own. The consent page and the
 * connected apps list each load it with their own data.
 */
export type AppInstaller = AppInstallerDto
