import type {
  GetReviewerSessionResponseDto,
  SubmitReviewerSessionReviewRequestDto,
  UpdateReviewerSessionReviewRequestDto,
} from "@caseai-connect/api-contracts"
import { useTranslation } from "react-i18next"
import { BlindBanner } from "./BlindBanner"
import { FactualAnswersPanel } from "./FactualAnswersPanel"
import { FormResultPanel } from "./FormResultPanel"
import { OtherReviewersPanel } from "./OtherReviewersPanel"
import { ReviewerReviewForm } from "./ReviewerReviewForm"
import { ReviewerSessionTranscript } from "./ReviewerSessionTranscript"
import { TesterFeedbackPanel } from "./TesterFeedbackPanel"

type Props = {
  session: GetReviewerSessionResponseDto
  onSubmitReview: (payload: SubmitReviewerSessionReviewRequestDto) => void
  onUpdateReview: (payload: UpdateReviewerSessionReviewRequestDto) => void
}

/**
 * Composition of the reviewer's session-review page. The `session` DTO is a
 * discriminated union — `blind: true` shows the redacted layout (factual
 * answers + empty form), `blind: false` shows the full layout (tester feedback
 * revealed, other reviewers, editable submitted review).
 */
export function ReviewerSessionReview({ session, onSubmitReview, onUpdateReview }: Props) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr] p-6">
      {/* Left pane: transcript + session context */}
      <div className="flex flex-col gap-4">
        {session.blind ? (
          <FactualAnswersPanel
            questions={session.factualTesterQuestions}
            answers={session.factualTesterAnswers}
          />
        ) : (
          <TesterFeedbackPanel
            questions={session.testerPerSessionQuestions}
            feedback={session.testerFeedback}
          />
        )}
        {session.formResult && <FormResultPanel result={session.formResult} />}
        <section className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("reviewerCampaigns:transcript.title")}</h3>
          <ReviewerSessionTranscript messages={session.transcript} />
        </section>
      </div>

      {/* Right pane: review form / submitted review / other reviewers */}
      <div className="flex flex-col gap-4">
        {session.blind ? (
          <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
            <header className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{t("reviewerCampaigns:review.yourReview")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("reviewerCampaigns:review.blindOtherReviewers", {
                  count: session.otherReviewerCount,
                })}
              </p>
            </header>
            <BlindBanner />
            <ReviewerReviewForm
              questions={session.reviewerQuestions}
              onSubmit={onSubmitReview}
              submitLabel={t("reviewerCampaigns:reviewForm.submitReview")}
            />
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-4 rounded-lg border bg-card p-4">
              <header>
                <h2 className="text-lg font-semibold">
                  {t("reviewerCampaigns:review.yourReview")}
                </h2>
              </header>
              <ReviewerReviewForm
                questions={session.reviewerQuestions}
                defaults={{
                  overallRating: session.myReview.overallRating,
                  comment: session.myReview.comment,
                  answers: session.myReview.answers,
                }}
                onSubmit={onUpdateReview}
                submitLabel={t("reviewerCampaigns:reviewForm.saveChanges")}
              />
            </section>
            <OtherReviewersPanel
              reviews={session.otherReviews}
              reviewerQuestions={session.reviewerQuestions}
            />
          </>
        )}
      </div>
    </div>
  )
}
