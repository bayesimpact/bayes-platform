import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/app-ui/components/dialog"
import type {
  CampaignContextOutputDto,
  ReviewCampaignParamsDto,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { SessionFeedbackForm } from "./SessionFeedbackForm"

export type SessionFeedbackDialogProps = {
  campaign: ReviewCampaignParamsDto
  context: CampaignContextOutputDto
  /** The session the tester gives feedback on, or `null` while the dialog is closed. */
  sessionId: string | null
  onClose: () => void
}

/** Asks a tester how a session went, from the list of their sessions. */
export function SessionFeedbackDialog({
  campaign,
  context,
  sessionId,
  onClose,
}: SessionFeedbackDialogProps) {
  return (
    <Dialog
      open={sessionId !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Trans>How was this session?</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Your feedback ends the session and helps improve the agent. You cannot change it
              afterwards.
            </Trans>
          </DialogDescription>
        </DialogHeader>
        {sessionId === null ? null : (
          <SessionFeedbackForm
            // Each session gets a blank form: nothing stays from the previous one.
            key={sessionId}
            campaign={campaign}
            context={context}
            sessionId={sessionId}
            onCancel={onClose}
            onSubmitted={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
