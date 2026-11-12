import { useTranslation } from "react-i18next"
import type { AppInstaller } from "../app-installers.models"

/** How to name who installed an app: "you", their name (or email), or "a former member". */
export function useInstallerLabel() {
  const { t } = useTranslation("appInstallers")
  return (installer: AppInstaller) => {
    switch (installer.kind) {
      case "me":
        return t("me")
      case "member":
        return installer.name ?? installer.email
      case "former-member":
        return t("formerMember")
    }
  }
}
