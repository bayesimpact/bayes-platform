import type { ReviewCampaignQuestionDto } from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useId } from "react"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { StarRatingInput } from "./StarRatingInput"

export type QuestionFieldProps = {
  question: ReviewCampaignQuestionDto
  /** The answer, or `null` before the person answers. */
  value: string | number | null
  onChange: (value: string | number) => void
  isInvalid?: boolean
  disabled?: boolean
}

/**
 * A question of a campaign with the control that answers it: stars for a rating, a text for a
 * free answer, the options for a single choice.
 */
export function QuestionField({
  question,
  value,
  onChange,
  isInvalid = false,
  disabled = false,
}: QuestionFieldProps) {
  const labelId = useId()
  const inputId = useId()
  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel id={labelId} htmlFor={question.type === "free-text" ? inputId : undefined}>
        {question.prompt.trim() === "" ? (
          <span className="text-muted-foreground italic">
            <Trans comment="A question whose text is still empty">Untitled</Trans>
          </span>
        ) : (
          question.prompt
        )}
        {question.required ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : null}
      </FieldLabel>
      {question.type === "rating" ? (
        <StarRatingInput
          aria-labelledby={labelId}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
          isInvalid={isInvalid}
          disabled={disabled}
        />
      ) : null}
      {question.type === "free-text" ? (
        <Textarea
          id={inputId}
          rows={2}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={isInvalid}
          aria-required={question.required}
          disabled={disabled}
        />
      ) : null}
      {question.type === "single-choice" ? (
        <ChoiceOptions
          labelId={labelId}
          options={question.options ?? []}
          value={typeof value === "string" ? value : null}
          onChange={onChange}
          disabled={disabled}
        />
      ) : null}
      {isInvalid ? (
        <FieldError>
          <Trans>Answer this question.</Trans>
        </FieldError>
      ) : null}
    </Field>
  )
}

type ChoiceOptionsProps = {
  labelId: string
  options: string[]
  value: string | null
  onChange: (value: string) => void
  disabled: boolean
}

function ChoiceOptions({ labelId, options, value, onChange, disabled }: ChoiceOptionsProps) {
  const groupId = useId()
  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        <Trans>This question has no option yet.</Trans>
      </p>
    )
  }
  return (
    <RadioGroup
      aria-labelledby={labelId}
      value={value ?? ""}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next)
      }}
      disabled={disabled}
    >
      {options.map((option, index) => {
        const optionId = `${groupId}-${index}`
        return (
          <div key={option} className="flex items-center gap-2">
            <RadioGroupItem id={optionId} value={option} />
            <Label htmlFor={optionId} className="font-normal">
              {option}
            </Label>
          </div>
        )
      })}
    </RadioGroup>
  )
}
