import { Button } from "@caseai-connect/app-ui/components/button"
import { Trans } from "@lingui/react/macro"
import { PlusIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { type Control, useFieldArray, useWatch } from "react-hook-form"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
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

/**
 * One of a campaign's lists of questions: add, order, edit and remove them. Removing a question
 * with text asks for a confirmation first.
 */
export function QuestionListEditor({
  control,
  list,
  title,
  description,
  hasFactual = false,
  disabled,
}: QuestionListEditorProps) {
  const { fields, append, move, remove } = useFieldArray({ control, name: list, keyName: "key" })
  const questions = useWatch({ control, name: list })
  const [removingIndex, setRemovingIndex] = useState<number | null>(null)
  const removedPrompt = removingIndex === null ? "" : (questions[removingIndex]?.prompt ?? "")
  const removedPosition = (removingIndex ?? 0) + 1
  // A question with no text yet goes at once: there is nothing to lose.
  const handleRemove = (index: number) => {
    if (questions[index]?.prompt.trim()) setRemovingIndex(index)
    else remove(index)
  }
  return (
    // No frame of its own: the step holds this list alone, and each question has its card.
    <section className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
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
              onRemove={handleRemove}
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
      <ConfirmDialog
        isOpen={removingIndex !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemovingIndex(null)
        }}
        title={<Trans>Remove question {removedPosition}?</Trans>}
        description={<Trans>“{removedPrompt}” leaves this list, with its settings.</Trans>}
        confirmLabel={<Trans comment="Removes a question from a campaign's list">Remove</Trans>}
        isDestructive
        isPending={false}
        onConfirm={() => {
          if (removingIndex !== null) remove(removingIndex)
          setRemovingIndex(null)
        }}
      />
    </section>
  )
}
