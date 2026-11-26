import { Button } from "@caseai-connect/app-ui/components/button"
import type { ConversationFormOutputDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { ClipboardListIcon } from "lucide-react"

export type FormsButtonProps = {
  forms: ConversationFormOutputDto[]
  isOpen: boolean
  onToggle: () => void
}

/** The button that opens the forms the agents fill in, saying whether one is still in progress. */
export function FormsButton({ forms, isOpen, onToggle }: FormsButtonProps) {
  const isInProgress = forms.some((form) => form.status === "in_progress")
  return (
    <Button
      variant={isOpen ? "secondary" : "outline"}
      size="sm"
      aria-pressed={isOpen}
      onClick={onToggle}
    >
      <ClipboardListIcon data-icon="inline-start" aria-hidden />
      {isInProgress ? <Trans>Form in progress</Trans> : <Trans>Completed form</Trans>}
    </Button>
  )
}
