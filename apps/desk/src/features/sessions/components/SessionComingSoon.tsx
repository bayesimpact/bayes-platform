import { Trans } from "@lingui/react/macro"
import { HourglassIcon } from "lucide-react"
import { StatusPage } from "@/components/shared/StatusPage"

export type SessionComingSoonProps = {
  kind: "conversation" | "extraction"
}

/** A past conversation or extraction, which opens in a next change of the Desk. */
export function SessionComingSoon({ kind }: SessionComingSoonProps) {
  return (
    <StatusPage
      icon={<HourglassIcon aria-hidden />}
      title={
        kind === "conversation" ? (
          <Trans>Past conversations open soon</Trans>
        ) : (
          <Trans>Past extractions open soon</Trans>
        )
      }
      description={<Trans>This page comes in the next version of the Desk.</Trans>}
    />
  )
}
