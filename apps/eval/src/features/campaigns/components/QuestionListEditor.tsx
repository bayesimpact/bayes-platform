import { Trans } from "@lingui/react/macro"
import { PlusIcon } from "lucide-react"
import type { ReactNode } from "react"
import { type Control, useFieldArray } from "react-hook-form"
import { SectionCard } from "@/components/shared/SectionCard"
import { Button } from "@/components/ui/button"
import { blankQuestion } from "../campaign-form"
import type { CampaignFormValues, QuestionListName } from "../schemas"
import { QuestionEditor } from "./QuestionEditor"

export type QuestionListEditorProps = {
  control: Control<CampaignFormValues>
  list: QuestionListName
  title: ReactNode
  description: ReactNode
  hasFactual?: boolean
  disabled: boolean
}

/** One of a campaign's lists of questions: add, order, edit and remove them. */
export function QuestionListEditor({
  control,
  list,
  title,
  description,
  hasFactual = false,
  disabled,
}: QuestionListEditorProps) {
  const { fields, append, move, remove } = useFieldArray({ control, name: list, keyName: "key" })
  return (
    <SectionCard title={title} description={description}>
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          <Trans>No question yet.</Trans>
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <QuestionEditor
              key={field.key}
              control={control}
              list={list}
              index={index}
              count={fields.length}
              hasFactual={hasFactual}
              disabled={disabled}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </ol>
      )}
      {disabled ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => append(blankQuestion())}
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          <Trans>Add a question</Trans>
        </Button>
      )}
    </SectionCard>
  )
}
