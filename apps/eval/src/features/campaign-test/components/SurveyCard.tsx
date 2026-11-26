import type { ReviewCampaignParamsDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { CheckCircle2Icon } from "lucide-react"
import { SectionCard } from "@/components/shared/SectionCard"
import { buttonVariants } from "@/components/ui/button"

export type SurveyCardProps = {
  campaign: ReviewCampaignParamsDto
  hasSurvey: boolean
}

/** The way to the final survey, which a tester fills once and can change while the campaign runs. */
export function SurveyCard({ campaign, hasSurvey }: SurveyCardProps) {
  return (
    <SectionCard
      title={<Trans>Final survey</Trans>}
      description={
        hasSurvey ? (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2Icon aria-hidden className="size-4 text-primary" />
            <Trans>You filled the survey. Thank you for your feedback.</Trans>
          </span>
        ) : (
          <Trans>
            When you are done testing, share an overall rating of the agent. It is optional: your
            feedback on each session already counts. You can still start sessions afterwards.
          </Trans>
        )
      }
    >
      <Link
        to="/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test/survey"
        params={campaign}
        className={cn(buttonVariants({ variant: "outline", className: "w-fit" }))}
      >
        {hasSurvey ? <Trans>Edit my survey</Trans> : <Trans>Fill the final survey</Trans>}
      </Link>
    </SectionCard>
  )
}
