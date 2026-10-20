import { Alert, AlertDescription } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { DialogFooter } from "@caseai-connect/ui/shad/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { ToggleGroup, ToggleGroupItem } from "@caseai-connect/ui/shad/toggle-group"
import { zodResolver } from "@hookform/resolvers/zod"
import { ThumbsDownIcon, ThumbsUpIcon, VenetianMaskIcon } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import type {
  TestCaseDraft,
  TestCaseInputMode,
  TestCaseJudgement,
  TestCaseSource,
} from "../test-cases.models"

const reviewFormSchema = z.object({
  inputMode: z.enum(["conversation", "lastMessage"]),
  input: z.string().trim().min(1, "The input cannot be empty."),
  expectedOutput: z.string().trim().min(1, "The expected answer cannot be empty."),
  anonymized: z.boolean(),
})

type ReviewFormValues = z.infer<typeof reviewFormSchema>

/** The LLM call in flight: the input is locked until it answers. */
type PendingAction = "drafting" | "anonymizing"

/**
 * Second step of saving a test case: the input and expected output proposed for the record, both editable.
 * Switching the input mode drafts the input again, and Anonymize asks an LLM to strip personal
 * data from it, whichever mode is chosen.
 */
export function TestCaseReviewStep({
  source,
  judgement,
  datasetName,
  draft,
  onDraftStandaloneQuestion,
  onAnonymize,
  onBack,
  onSave,
}: {
  source: TestCaseSource
  judgement: TestCaseJudgement
  datasetName: string
  draft: TestCaseDraft
  onDraftStandaloneQuestion: () => Promise<string>
  onAnonymize: (text: string) => Promise<string>
  onBack: () => void
  onSave: (draft: TestCaseDraft) => Promise<void>
}) {
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: draft,
  })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const inputMode = useWatch({ control: form.control, name: "inputMode" })
  const anonymized = useWatch({ control: form.control, name: "anonymized" })
  const isBusy = pendingAction !== null || form.formState.isSubmitting

  const replaceInput = (input: string, isAnonymized: boolean) => {
    form.setValue("input", input, { shouldDirty: true, shouldValidate: true })
    form.setValue("anonymized", isAnonymized)
  }

  const handleInputModeChange = async (nextMode: TestCaseInputMode) => {
    form.setValue("inputMode", nextMode)
    if (nextMode === "lastMessage") {
      replaceInput(source.lastUserMessage, false)
      return
    }
    setPendingAction("drafting")
    try {
      replaceInput(await onDraftStandaloneQuestion(), false)
    } catch {
      form.setError("input", {
        message: "The question could not be drafted. Try again, or write it yourself.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleAnonymize = async () => {
    setPendingAction("anonymizing")
    try {
      replaceInput(await onAnonymize(form.getValues("input")), true)
    } catch {
      form.setError("input", { message: "The input could not be anonymized. Try again." })
    } finally {
      setPendingAction(null)
    }
  }

  const handleValid = async (values: ReviewFormValues) => {
    try {
      await onSave(values)
    } catch {
      form.setError("root", { message: "The record could not be saved. Try again." })
    }
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(handleValid)}>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <Badge variant="outline">
              {judgement.verdict === "good" ? <ThumbsUpIcon /> : <ThumbsDownIcon />}
              {judgement.verdict === "good" ? "Good answer" : "Bad answer"}
            </Badge>
            to
            <span className="font-medium text-foreground">{datasetName}</span>
          </div>
          {judgement.comment && <p className="text-muted-foreground italic">{judgement.comment}</p>}
        </div>

        <FormField
          control={form.control}
          name="input"
          render={({ field }) => (
            <FormItem>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FormLabel>Input</FormLabel>
                  {anonymized && <Badge variant="secondary">Anonymized</Badge>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleAnonymize}
                >
                  {pendingAction === "anonymizing" ? <Spinner /> : <VenetianMaskIcon />}
                  Anonymize
                </Button>
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={inputMode}
                disabled={isBusy}
                onValueChange={(nextMode) =>
                  nextMode && handleInputModeChange(nextMode as TestCaseInputMode)
                }
              >
                <ToggleGroupItem value="conversation" disabled={source.earlierTurnCount === 0}>
                  {pendingAction === "drafting" && <Spinner />}
                  Conversation context
                </ToggleGroupItem>
                <ToggleGroupItem value="lastMessage">Exact last message</ToggleGroupItem>
              </ToggleGroup>
              <FormControl>
                <Textarea rows={4} disabled={pendingAction !== null} {...field} />
              </FormControl>
              <FormDescription>
                {describeInputMode(inputMode, source.earlierTurnCount)}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expectedOutput"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expected answer</FormLabel>
              <FormControl>
                <Textarea rows={6} {...field} />
              </FormControl>
              <FormDescription>
                {judgement.verdict === "good"
                  ? "The agent's answer, kept as the reference each run is graded against."
                  : "Drafted by an LLM from what you said is wrong. Each run is graded against it."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={isBusy} onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={isBusy}>
            {form.formState.isSubmitting && <Spinner />}
            Save test case
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function describeInputMode(inputMode: TestCaseInputMode, earlierTurnCount: number): string {
  if (earlierTurnCount === 0) {
    return "This answer replies to the first message, so that message holds the whole conversation."
  }
  const earlierTurns = earlierTurnCount === 1 ? "earlier turn" : `${earlierTurnCount} earlier turns`
  return inputMode === "conversation"
    ? `Written by an LLM from the ${earlierTurns}, so the question stands on its own when a run replays it.`
    : `The user's last message as sent. A run does not replay the ${earlierTurns}.`
}
