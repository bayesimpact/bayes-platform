import type { ConversationFormOutputDto } from "@caseai-connect/desk-contracts"
import { Trans } from "@lingui/react/macro"
import { ClipboardListIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

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
      <ClipboardListIcon aria-hidden />
      {isInProgress ? <Trans>Form in progress</Trans> : <Trans>Completed form</Trans>}
    </Button>
  )
}
