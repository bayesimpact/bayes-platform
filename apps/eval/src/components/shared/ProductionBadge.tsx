import { Badge } from "@caseai-connect/app-ui/components/badge"
import { Trans } from "@lingui/react/macro"
import { SUCCESS_BADGE_CLASSES } from "@/lib/success-classes"

/** The green mark of the version every live channel runs with, as the Studio shows it. */
export function ProductionBadge() {
  return (
    <Badge className={SUCCESS_BADGE_CLASSES}>
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-green-600" />
      <Trans comment="The version of an agent its live channels run with">In production</Trans>
    </Badge>
  )
}
