import type {
  CampaignContextOutputDto,
  CampaignSessionParamsDto,
} from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { SidePanel } from "@/components/shared/SidePanel"
import { SessionFeedbackForm } from "./SessionFeedbackForm"

export type SessionFeedbackPanelProps = {
  sessionParams: CampaignSessionParamsDto
  context: CampaignContextOutputDto
  onClose: () => void
  /** Called once the feedback is saved. */
  onSubmitted: () => void
}

/**
 * Asks a tester how a session went, in a panel beside the conversation, which they can read again
 * while they answer.
 */
export function SessionFeedbackPanel({
  sessionParams,
  context,
  onClose,
  onSubmitted,
}: SessionFeedbackPanelProps) {
  return (
    <SidePanel
      title={<Trans>How was this session?</Trans>}
      description={
        <Trans>
          Your feedback ends the session and helps improve the agent. You cannot change it
          afterwards.
        </Trans>
      }
      onClose={onClose}
    >
      <SessionFeedbackForm
        campaign={sessionParams}
        context={context}
        sessionId={sessionParams.sessionId}
        onCancel={onClose}
        onSubmitted={onSubmitted}
      />
    </SidePanel>
  )
}
