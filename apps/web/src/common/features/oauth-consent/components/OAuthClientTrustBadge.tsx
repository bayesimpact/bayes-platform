import { Badge } from "@caseai-connect/ui/shad/badge"
import { BadgeCheckIcon, TriangleAlertIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

/** Verified or unverified badge of an OAuth client, shared by the consent page and connected apps. */
export function OAuthClientTrustBadge({ verified }: { verified: boolean }) {
  const { t } = useTranslation("oauthConsent")
  if (verified) {
    return (
      <Badge variant="success">
        <BadgeCheckIcon aria-hidden />
        {t("verified")}
      </Badge>
    )
  }
  return (
    <Badge variant="warning">
      <TriangleAlertIcon aria-hidden />
      {t("unverified")}
    </Badge>
  )
}
