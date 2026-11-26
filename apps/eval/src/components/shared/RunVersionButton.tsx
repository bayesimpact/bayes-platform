import { Button } from "@caseai-connect/app-ui/components/button"
import { useLingui } from "@lingui/react/macro"

export type RunVersionButtonProps = {
  /** The revision of the agent's version a run asked. */
  revision: number
  /** The saved versions of the agent: an archived one is not among them. */
  versions: { revision: number }[]
  /** Shows the history of the agent's versions, on this one. */
  onShow: (revision: number) => void
}

/**
 * The version a run asked, in the table of runs: a link that opens the history of the agent's
 * versions to compare it. An archived version is not in the history: its number shows alone.
 */
export function RunVersionButton({ revision, versions, onShow }: RunVersionButtonProps) {
  const { t } = useLingui()
  if (!versions.some((version) => version.revision === revision)) return revision
  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto p-0 tabular-nums"
      aria-label={t`Compare version ${revision} with the others`}
      onClick={() => onShow(revision)}
    >
      {revision}
    </Button>
  )
}
