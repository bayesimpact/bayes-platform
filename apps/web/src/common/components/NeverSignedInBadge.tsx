import { Badge } from "@caseai-connect/ui/shad/badge"
import { useTranslation } from "react-i18next"

/** Marks a member added by email who has not signed in yet. */
export function NeverSignedInBadge() {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className="text-muted-foreground normal-case">
      {t("status:neverSignedIn")}
    </Badge>
  )
}
