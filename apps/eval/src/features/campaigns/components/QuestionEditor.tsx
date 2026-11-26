import { Button } from "@caseai-connect/app-ui/components/button"
import { Checkbox } from "@caseai-connect/app-ui/components/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@caseai-connect/app-ui/components/field"
import { Input } from "@caseai-connect/app-ui/components/input"
import { Label } from "@caseai-connect/app-ui/components/label"
import { ToggleGroup, ToggleGroupItem } from "@caseai-connect/app-ui/components/toggle-group"
import { reviewCampaignQuestionTypeSchema } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react"
import { useId } from "react"
import { type Control, Controller, useWatch } from "react-hook-form"
import type { CampaignFormValues, QuestionListName } from "../schemas"

export type QuestionEditorProps = {
  control: Control<CampaignFormValues>
  list: QuestionListName
  index: number
  /** How many questions the list holds, to know which one is last. */
  count: number
  /** Whether the list's answers can be marked factual: the testers' per-session ones. */
  hasFactual: boolean
  disabled: boolean
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}

/** One question of a list: its text, its type, its options, and whether it must be answered. */
export function QuestionEditor({
  control,
  list,
  index,
  count,
  hasFactual,
  disabled,
  onMove,
  onRemove,
}: QuestionEditorProps) {
  const { t } = useLingui()
  const promptId = useId()
  const optionsId = useId()
  const requiredId = useId()
  const factualId = useId()
  const type = useWatch({ control, name: `${list}.${index}.type` })
  const position = index + 1

  return (
    <li className="flex flex-col gap-4 rounded-lg border bg-background p-4 dark:bg-card">
      <div className="flex items-start gap-2">
        <Controller
          control={control}
          name={`${list}.${index}.prompt`}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="flex-1">
              <FieldLabel htmlFor={promptId}>
                <Trans comment="The text of question number {position} of a campaign">
                  Question {position}
                </Trans>
              </FieldLabel>
              <Input
                {...field}
                id={promptId}
                placeholder={t`e.g. Was the answer clear?`}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
              />
              {fieldState.invalid ? (
                <FieldError>
                  <Trans>Write the question.</Trans>
                </FieldError>
              ) : null}
            </Field>
          )}
        />
        {disabled ? null : (
          <div className="flex gap-1 pt-6">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t`Move question ${position} up`}
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              <ArrowUpIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t`Move question ${position} down`}
              disabled={index === count - 1}
              onClick={() => onMove(index, index + 1)}
            >
              <ArrowDownIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t`Remove question ${position}`}
              onClick={() => onRemove(index)}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </div>
        )}
      </div>
      <Controller
        control={control}
        name={`${list}.${index}.type`}
        render={({ field }) => (
          <ToggleGroup
            aria-label={t`Type of question ${position}`}
            variant="outline"
            size="sm"
            spacing={0}
            value={[field.value]}
            disabled={disabled}
            // A toggle group lets every item go: the type stays when the person clicks it again.
            onValueChange={(values) => {
              const next = reviewCampaignQuestionTypeSchema.safeParse(values[0])
              if (next.success) field.onChange(next.data)
            }}
          >
            <ToggleGroupItem value="rating">
              <Trans comment="A question answered with 1 to 5 stars">Rating (1–5)</Trans>
            </ToggleGroupItem>
            <ToggleGroupItem value="single-choice">
              <Trans comment="A question answered by picking one option">Single choice</Trans>
            </ToggleGroupItem>
            <ToggleGroupItem value="free-text">
              <Trans comment="A question answered with a text">Free text</Trans>
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      />
      {type === "single-choice" ? (
        <Controller
          control={control}
          name={`${list}.${index}.optionsText`}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={optionsId}>
                <Trans>Options, separated by commas</Trans>
              </FieldLabel>
              <Input
                {...field}
                id={optionsId}
                placeholder={t`Yes, No, Not sure`}
                aria-invalid={fieldState.invalid}
                disabled={disabled}
              />
              {fieldState.invalid ? (
                <FieldError>
                  <Trans>Write two options at least.</Trans>
                </FieldError>
              ) : null}
            </Field>
          )}
        />
      ) : null}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <Controller
          control={control}
          name={`${list}.${index}.required`}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id={requiredId}
                checked={field.value}
                onCheckedChange={(isChecked) => field.onChange(isChecked === true)}
                disabled={disabled}
              />
              <Label htmlFor={requiredId} className="font-normal">
                <Trans comment="A question that must be answered">Required</Trans>
              </Label>
            </div>
          )}
        />
        {hasFactual && type !== "free-text" ? (
          <Controller
            control={control}
            name={`${list}.${index}.isFactual`}
            render={({ field }) => (
              <Field orientation="horizontal" className="w-auto items-start">
                <Checkbox
                  id={factualId}
                  checked={field.value}
                  onCheckedChange={(isChecked) => field.onChange(isChecked === true)}
                  disabled={disabled}
                />
                <div className="flex flex-col gap-1">
                  <Label htmlFor={factualId} className="font-normal">
                    <Trans comment="A question about what happened in a session, not an opinion">
                      Factual
                    </Trans>
                  </Label>
                  <FieldDescription>
                    <Trans>
                      Reviewers see the answer before they submit their own review. An opinion stays
                      hidden until then.
                    </Trans>
                  </FieldDescription>
                </div>
              </Field>
            )}
          />
        ) : null}
      </div>
    </li>
  )
}
