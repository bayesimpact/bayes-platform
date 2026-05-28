import type {
  ReviewCampaignQuestionDto,
  ReviewCampaignQuestionType,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Field, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

const QUESTION_TYPES: ReviewCampaignQuestionType[] = ["rating", "single-choice", "free-text"]

type Props = {
  label: string
  description?: string
  questions: ReviewCampaignQuestionDto[]
  onChange: (next: ReviewCampaignQuestionDto[]) => void
  disabled?: boolean
  /**
   * When true, renders an "Is factual" toggle on rating / single-choice
   * questions. Only relevant for tester per-session questions — controls
   * whether the tester's answer stays visible to reviewers during blind
   * review. Free-text questions never show the toggle (they're always
   * treated as opinion).
   */
  showFactualToggle?: boolean
}

const makeEmptyQuestion = (): ReviewCampaignQuestionDto => ({
  id: crypto.randomUUID(),
  prompt: "",
  type: "rating",
  required: false,
})

const formatOptions = (options: string[] | undefined): string => (options ?? []).join(", ")

export const parseOptionsText = (optionsText: string): string[] =>
  optionsText
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean)

export function QuestionListEditor({
  label,
  description,
  questions,
  onChange,
  disabled = false,
  showFactualToggle = false,
}: Props) {
  const { t } = useTranslation()
  const [optionsTextByQuestionId, setOptionsTextByQuestionId] = useState<Record<string, string>>({})

  const update = (index: number, patch: Partial<ReviewCampaignQuestionDto>) => {
    onChange(
      questions.map((question, currentIndex) =>
        currentIndex === index ? { ...question, ...patch } : question,
      ),
    )
  }

  const remove = (index: number) => {
    onChange(questions.filter((_, currentIndex) => currentIndex !== index))
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= questions.length) return
    const next = [...questions]
    const [removed] = next.splice(index, 1)
    if (!removed) return
    next.splice(target, 0, removed)
    onChange(next)
  }

  const add = () => {
    onChange([...questions, makeEmptyQuestion()])
  }

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h3 className="text-sm font-semibold">{label}</h3>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </header>

      {questions.length === 0 && (
        <p className="text-muted-foreground text-sm italic">
          {t("reviewCampaigns:questions.empty")}
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {questions.map((question, index) => (
          <li
            key={question.id}
            className="rounded-md border p-3 flex flex-col gap-3"
            data-testid={`question-${index}`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <Field className="md:flex-1">
                <FieldLabel htmlFor={`prompt-${question.id}`}>
                  {t("reviewCampaigns:questions.prompt")}
                </FieldLabel>
                <Input
                  id={`prompt-${question.id}`}
                  value={question.prompt}
                  disabled={disabled}
                  onChange={(event) => update(index, { prompt: event.target.value })}
                  placeholder={t("reviewCampaigns:questions.promptPlaceholder")}
                />
              </Field>

              <Field className="md:w-48">
                <FieldLabel htmlFor={`type-${question.id}`}>
                  {t("reviewCampaigns:questions.type")}
                </FieldLabel>
                <Select
                  value={question.type}
                  disabled={disabled}
                  onValueChange={(value) =>
                    update(index, { type: value as ReviewCampaignQuestionType })
                  }
                >
                  <SelectTrigger id={`type-${question.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`reviewCampaigns:questions.types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {question.type === "single-choice" && (
              <Field>
                <FieldLabel htmlFor={`options-${question.id}`}>
                  {t("reviewCampaigns:questions.options")}
                </FieldLabel>
                <Input
                  id={`options-${question.id}`}
                  value={optionsTextByQuestionId[question.id] ?? formatOptions(question.options)}
                  disabled={disabled}
                  placeholder={t("reviewCampaigns:questions.optionsPlaceholder")}
                  onChange={(event) => {
                    const optionsText = event.target.value
                    setOptionsTextByQuestionId((previous) => ({
                      ...previous,
                      [question.id]: optionsText,
                    }))
                    update(index, {
                      options: parseOptionsText(optionsText),
                    })
                  }}
                />
              </Field>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`required-${question.id}`}
                    checked={question.required}
                    disabled={disabled}
                    onCheckedChange={(checked) => update(index, { required: checked })}
                  />
                  <label htmlFor={`required-${question.id}`} className="text-sm">
                    {t("reviewCampaigns:questions.required")}
                  </label>
                </div>
                {showFactualToggle && question.type !== "free-text" && (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`factual-${question.id}`}
                      checked={question.isFactual === true}
                      disabled={disabled}
                      onCheckedChange={(checked) => update(index, { isFactual: checked })}
                    />
                    <label htmlFor={`factual-${question.id}`} className="text-sm">
                      {t("reviewCampaigns:questions.factual")}
                    </label>
                    <span
                      className="text-muted-foreground text-xs"
                      title={t("reviewCampaigns:questions.factualTooltip")}
                    >
                      {t("reviewCampaigns:questions.factualHint")}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t("reviewCampaigns:questions.moveUp")}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || index === questions.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t("reviewCampaigns:questions.moveDown")}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  aria-label={t("reviewCampaigns:questions.remove")}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={add}
        className="self-start"
      >
        <PlusIcon /> {t("reviewCampaigns:questions.add")}
      </Button>
    </section>
  )
}
