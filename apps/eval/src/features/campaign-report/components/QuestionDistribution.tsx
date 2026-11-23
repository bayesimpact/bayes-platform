import type { CampaignReportDistributionOutputDto } from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export type QuestionDistributionProps = {
  distribution: CampaignReportDistributionOutputDto
}

/** How the answers to one question spread: one bar per rating or option, with its count. */
export function QuestionDistribution({ distribution }: QuestionDistributionProps) {
  const { t, i18n } = useLingui()
  const total = distribution.buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const responseCount = distribution.responseCount
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{distribution.prompt}</h3>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">
            <QuestionTypeLabel type={distribution.type} />
          </Badge>
          <Plural value={responseCount} one="# answer" other="# answers" />
        </span>
      </div>
      {distribution.type === "free-text" ? (
        <p className="text-sm text-muted-foreground italic">
          <Trans>Free-text answers are not summarized here: read them in each session.</Trans>
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          <Trans>No answer yet.</Trans>
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {distribution.buckets.map((bucket) => {
            const share = bucket.count / total
            const percent = i18n.number(share, { style: "percent", maximumFractionDigits: 0 })
            const count = bucket.count
            return (
              <li
                key={bucket.label}
                className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-sm"
              >
                <span className="truncate">{bucket.label}</span>
                <Progress value={share * 100} aria-label={t`${count} answers, ${percent}`} />
                <span className="text-right text-muted-foreground tabular-nums">
                  {i18n.number(bucket.count)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type QuestionTypeLabelProps = {
  type: CampaignReportDistributionOutputDto["type"]
}

function QuestionTypeLabel({ type }: QuestionTypeLabelProps) {
  switch (type) {
    case "rating":
      return <Trans comment="A question answered with 1 to 5 stars">Rating</Trans>
    case "single-choice":
      return <Trans comment="A question answered by picking one option">Single choice</Trans>
    case "free-text":
      return <Trans comment="A question answered with a text">Free text</Trans>
    default:
      return type satisfies never
  }
}
