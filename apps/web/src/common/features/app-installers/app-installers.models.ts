/**
 * Who installed an app on a workspace, as the person looking sees them. A former member can no
 * longer install apps there: they left the workspace, lost the permission, or have no account any
 * more. Nobody is left to ask, so someone else may reconnect the app and become its installer.
 */
export type AppInstaller =
  | { kind: "me" }
  | { kind: "member"; name: string | null; email: string }
  | { kind: "former-member" }
