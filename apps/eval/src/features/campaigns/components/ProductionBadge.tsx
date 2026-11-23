import { Trans } from "@lingui/react/macro"
import { Badge } from "@/components/ui/badge"

/** The green mark of the version every live channel runs with, as the Studio shows it. */
export function ProductionBadge() {
  return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-green-600" />
      <Trans comment="The version of an agent its live channels run with">In production</Trans>
    </Badge>
  )
}
