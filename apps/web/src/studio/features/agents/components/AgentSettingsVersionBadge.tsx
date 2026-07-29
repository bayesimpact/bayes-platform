import { Badge } from "@caseai-connect/ui/shad/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { cn } from "@caseai-connect/ui/utils"
import { useTranslation } from "react-i18next"

type Props = {
  revision: number
  revisionName: string
  isDraft: boolean
  /** Shown in a tooltip. Header only: a message marker has no description to show. */
  description?: string
  /** Message-marker scale: smaller and muted. */
  compact?: boolean
}

/**
 * Names a settings revision wherever the playground needs to say which one is in play: the
 * session header, and the marker above the first message of each revision.
 *
 * Takes the revision fields rather than an `AgentSettings` object so the same component renders
 * from `AgentMessageSettingsDto`, the narrow shape carried on a message.
 */
export function AgentSettingsVersionBadge({
  revision,
  revisionName,
  isDraft,
  description,
  compact,
}: Props) {
  const { t } = useTranslation()

  const badge = (
    <Badge
      variant={isDraft ? "outline" : "secondary"}
      className={cn(compact && "text-xs font-normal text-muted-foreground")}
    >
      v{revision}
      {isDraft && ` · ${t("agent:history.draftBadge")}`}
      {revisionName && ` · ${revisionName}`}
    </Badge>
  )

  if (!description) return badge

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs">{description}</TooltipContent>
    </Tooltip>
  )
}
