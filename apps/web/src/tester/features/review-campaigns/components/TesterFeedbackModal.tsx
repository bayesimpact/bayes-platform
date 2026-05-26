import type {
  ReviewCampaignQuestionDto,
  ReviewCampaignTesterFeedbackAnswerDto,
  SubmitTesterSessionFeedbackRequestDto,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { DynamicQuestionField } from "./DynamicQuestionField"
import { StarRatingInput } from "./StarRatingInput"

type AnswerValue = string | number | string[] | null

type Props = {
  open: boolean
  questions: ReviewCampaignQuestionDto[]
  onSubmit: (payload: SubmitTesterSessionFeedbackRequestDto) => void
  onAbandon: () => void
}

export function TesterFeedbackModal({ open, questions, onSubmit, onAbandon }: Props) {
  // FIXME: use useForm
  const { t } = useTranslation()
  const [overallRating, setOverallRating] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})

  const missingRequired = useMemo(
    () =>
      questions.some(
        (question) =>
          question.required &&
          (answers[question.id] === undefined ||
            answers[question.id] === null ||
            answers[question.id] === ""),
      ),
    [questions, answers],
  )

  const canSubmit = overallRating !== null && !missingRequired

  const handleSubmit = () => {
    if (overallRating === null) return
    const payload: SubmitTesterSessionFeedbackRequestDto = {
      overallRating,
      comment: comment.trim() === "" ? null : comment,
      answers: toAnswerList(answers),
    }
    onSubmit(payload)
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("testerCampaigns:feedbackModal.title")}</DialogTitle>
          <DialogDescription>{t("testerCampaigns:feedbackModal.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <Field>
            <FieldLabel>
              {t("testerCampaigns:feedbackModal.overallRating")}{" "}
              <span className="text-destructive ml-1">*</span>
            </FieldLabel>
            <StarRatingInput
              value={overallRating}
              onChange={setOverallRating}
              aria-label={t("testerCampaigns:feedbackModal.overallRatingAriaLabel")}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="tester-comment">
              {t("testerCampaigns:feedbackModal.comment")}
            </FieldLabel>
            <Textarea
              id="tester-comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t("testerCampaigns:feedbackModal.commentPlaceholder")}
            />
          </Field>

          {questions.map((question) => (
            <DynamicQuestionField
              key={question.id}
              question={question}
              value={answers[question.id] ?? null}
              onChange={(value) =>
                setAnswers((previous) => ({ ...previous, [question.id]: value }))
              }
            />
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onAbandon}>
            {t("testerCampaigns:feedbackModal.skipAndAbandon")}
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {t("testerCampaigns:feedbackModal.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toAnswerList(
  answersByQuestionId: Record<string, AnswerValue>,
): ReviewCampaignTesterFeedbackAnswerDto[] {
  return Object.entries(answersByQuestionId)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([questionId, value]) => ({
      questionId,
      value: value as ReviewCampaignTesterFeedbackAnswerDto["value"],
    }))
}
