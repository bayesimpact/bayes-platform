import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { EllipsisIcon, ExternalLinkIcon, RotateCcwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { HeaderActions } from "@/components/shared/HeaderActions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { openBlankTab } from "@/lib/safe-url"
import { useOpenExtractionFile } from "../api/mutations"

export type ExtractionRunActionsProps = {
  agent: AgentParamsDto
  documentId: string
  /** Extracting again shows once the run ended. */
  canExtractAgain: boolean
  isExtractingAgain: boolean
  onExtractAgain: () => void
  onDelete: () => void
}

/**
 * The actions of an extraction, in the bar above the page, as the Claude app puts a page's
 * actions: extracting the document again, and a menu to open it or delete the extraction.
 */
export function ExtractionRunActions({
  agent,
  documentId,
  canExtractAgain,
  isExtractingAgain,
  onExtractAgain,
  onDelete,
}: ExtractionRunActionsProps) {
  const { t } = useLingui()
  const openFile = useOpenExtractionFile(agent)

  const handleOpenDocument = () =>
    openFile.mutate(
      { file: { kind: "document", documentId }, tab: openBlankTab() },
      { onError: () => toast.error(t`The document could not be opened.`) },
    )

  return (
    <HeaderActions>
      {canExtractAgain ? (
        <Button variant="outline" size="sm" onClick={onExtractAgain} disabled={isExtractingAgain}>
          <RotateCcwIcon aria-hidden />
          <span className="max-sm:sr-only">
            <Trans>Extract again</Trans>
          </span>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={t`More actions`} />}
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleOpenDocument}>
            <ExternalLinkIcon aria-hidden />
            <Trans>Open the document</Trans>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2Icon aria-hidden />
            <Trans>Delete the extraction</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </HeaderActions>
  )
}
