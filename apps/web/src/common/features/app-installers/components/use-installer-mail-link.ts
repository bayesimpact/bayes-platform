import { useTranslation } from "react-i18next"
import type { AppInstaller } from "../app-installers.models"

/**
 * The mail link to who installed an app, with a subject that names the app and the workspace, so
 * asking them is one click.
 */
export function useInstallerMailLink() {
  const { t } = useTranslation("appInstallers")
  return (
    installer: Extract<AppInstaller, { kind: "member" }>,
    app: { appName: string; workspaceName: string },
  ) => {
    const subject = t("emailSubject", { name: app.appName, workspace: app.workspaceName })
    return `mailto:${installer.email}?subject=${encodeURIComponent(subject)}`
  }
}
