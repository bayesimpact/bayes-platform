import { Button } from "@caseai-connect/app-ui/components/button"
import { Trans } from "@lingui/react/macro"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import type { ReactNode } from "react"

export type SetupStepFooterProps = {
  /** Goes to the step before, or none on the first step. */
  onBack?: () => void
  /** Goes to the step after; none where the step moves on in its own way. */
  onNext?: () => void
  nextLabel?: ReactNode
  isPending?: boolean
}

/** The bottom of a step of the setup: the way back, and the way on. */
export function SetupStepFooter({ onBack, onNext, nextLabel, isPending }: SetupStepFooterProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} disabled={isPending}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          <Trans comment="Goes to the step before, in a campaign's setup">Back</Trans>
        </Button>
      ) : (
        <span />
      )}
      {onNext ? (
        <Button onClick={onNext} disabled={isPending}>
          {nextLabel ?? <Trans comment="Goes to the step after, in a campaign's setup">Next</Trans>}
          <ArrowRightIcon data-icon="inline-end" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
