import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { Badge } from "@/components/ui/badge"

export type AgentVersionTitleProps = {
  version: AgentVersionOutputDto
}

/** A saved version of an agent by its number and its name, and whether it is in production. */
export function AgentVersionTitle({ version }: AgentVersionTitleProps) {
  const revision = version.revision
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium">
        <Trans comment="A saved version of an agent's settings, by its number">
          Version {revision}
        </Trans>
      </span>
      {version.name ? <span className="text-muted-foreground">{version.name}</span> : null}
      {version.isProduction ? (
        <Badge variant="secondary">
          <Trans comment="The version of an agent its live channels run with">In production</Trans>
        </Badge>
      ) : null}
    </span>
  )
}
