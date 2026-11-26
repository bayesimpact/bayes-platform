import { Badge } from "@caseai-connect/app-ui/components/badge"
import type { ConversationRunRecordOutputDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { scoreOf } from "../score"

export type RunRecordScoreProps = {
  record: ConversationRunRecordOutputDto
}

/**
 * The score of a record of a run, colored by how good it is, or where the record stands while it
 * has none: waiting, not asked, or stopped by an error.
 */
export function RunRecordScore({ record }: RunRecordScoreProps) {
  const { i18n } = useLingui()
  const { score, status } = record
  if (score !== null) {
    return (
      <Badge variant={score >= 4 ? "secondary" : score >= 3 ? "outline" : "destructive"}>
        {scoreOf(score, i18n.locale)}
      </Badge>
    )
  }
  if (status === "error") {
    return (
      <Badge variant="destructive">
        <Trans comment="A record of a run an error stopped">Error</Trans>
      </Badge>
    )
  }
  return <span className="text-muted-foreground">–</span>
}
