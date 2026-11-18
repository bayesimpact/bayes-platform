import type { ReviewCampaignDetailOutputDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans } from "@lingui/react/macro"
import { RocketIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"

export type ActivateStepProps = {
  campaign: ReviewCampaignDetailOutputDto
  isPending: boolean
  onActivate: () => void
}

/**
 * The step that opens a campaign: what it will ask, list by list, then the activation, which
 * freezes the questions.
 */
export function ActivateStep({ campaign, isPending, onActivate }: ActivateStepProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const name = campaign.name
  const sessionCount = campaign.testerPerSessionQuestions.length
  const finalCount = campaign.testerEndOfPhaseQuestions.length
  const reviewerCount = campaign.reviewerQuestions.length
  return (
    <SectionCard
      title={<Trans>Ready to open “{name}”?</Trans>}
      description={
        <Trans>
          Once active, the questions can no longer change, and you can invite testers and reviewers.
        </Trans>
      }
    >
      <dl className="grid gap-3 sm:grid-cols-3">
        <SummaryEntry
          label={<Trans>After each session</Trans>}
          value={<Plural value={sessionCount} one="# question" other="# questions" />}
        />
        <SummaryEntry
          label={<Trans>Final survey</Trans>}
          value={<Plural value={finalCount} one="# question" other="# questions" />}
        />
        <SummaryEntry
          label={<Trans>Session review</Trans>}
          value={<Plural value={reviewerCount} one="# question" other="# questions" />}
        />
      </dl>
      <div>
        <Button onClick={() => setIsConfirming(true)} disabled={isPending}>
          <RocketIcon data-icon="inline-start" aria-hidden />
          <Trans>Activate the campaign</Trans>
        </Button>
      </div>
      <ConfirmDialog
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        title={<Trans>Activate “{name}”?</Trans>}
        description={
          <Trans>
            Once active, the campaign's questions can no longer change, and its testers and
            reviewers can see it. You can still invite more people.
          </Trans>
        }
        confirmLabel={
          <Trans comment="Opens a review campaign to its testers and reviewers">Activate</Trans>
        }
        isPending={isPending}
        onConfirm={onActivate}
      />
    </SectionCard>
  )
}

type SummaryEntryProps = { label: ReactNode; value: ReactNode }

function SummaryEntry({ label, value }: SummaryEntryProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
