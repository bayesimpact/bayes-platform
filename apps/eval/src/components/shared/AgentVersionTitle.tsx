import type { AgentVersionOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { ProductionBadge } from "./ProductionBadge"

export type AgentVersionTitleProps = {
  version: AgentVersionOutputDto
}

/**
 * A saved version of an agent: its number and whether it is in production, then on their own
 * lines the name and the description its author gave it, when they did.
 */
export function AgentVersionTitle({ version }: AgentVersionTitleProps) {
  const revision = version.revision
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          <Trans comment="A saved version of an agent's settings, by its number">
            Version {revision}
          </Trans>
        </span>
        {version.isProduction ? <ProductionBadge /> : null}
      </span>
      {version.name ? <span className="font-medium">{version.name}</span> : null}
      {version.description ? (
        <span className="text-sm font-normal text-muted-foreground">{version.description}</span>
      ) : null}
    </span>
  )
}
