import { useTranslation } from "react-i18next"
import type { AppInstaller } from "../oauth-consent.models"

/** How to name who installed an app: "you", their name (or email), or "a former member". */
export function useInstallerLabel() {
  const { t } = useTranslation("oauthConsent")
  return (installer: AppInstaller) => {
    switch (installer.kind) {
      case "me":
        return t("installer.me")
      case "member":
        return installer.name ?? installer.email
      case "former-member":
        return t("installer.formerMember")
    }
  }
}
