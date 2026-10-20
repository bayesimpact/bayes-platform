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
import type { TFunction } from "i18next"
import { ThumbsDownIcon, ThumbsUpIcon, VenetianMaskIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import type {
  TestCaseDraft,
  TestCaseInputDraft,
  TestCaseInputMode,
  TestCaseJudgement,
} from "../test-cases.models"

type ReviewFormValues = TestCaseDraft

/** The LLM call in flight: the input is locked until it answers. */
type PendingAction = "drafting" | "anonymizing"

/**
 * Second step of saving a test case: the input and expected output proposed for the record, both
 * editable. Switching the input mode drafts the input again, and Anonymize asks an LLM to strip
 * personal data from it, whichever mode is chosen.
 */
export function TestCaseReviewStep({
  judgement,
  datasetName,
  inputDraft,
  draft,
  onDraftInput,
  onAnonymize,
  onBack,
  onSave,
}: {
  judgement: TestCaseJudgement
  datasetName: string
  /** The last user message and the count of turns before it, which the mode switch relies on. */
  inputDraft: TestCaseInputDraft
  draft: TestCaseDraft
  onDraftInput: (inputMode: TestCaseInputMode) => Promise<TestCaseInputDraft>
  onAnonymize: (text: string) => Promise<string>
  onBack: () => void
  onSave: (draft: TestCaseDraft) => Promise<void>
}) {
  const { t } = useTranslation()
  const reviewFormSchema = useMemo(
    () =>
      z.object({
        inputMode: z.enum(["conversation", "lastMessage"]),
        input: z.string().trim().min(1, t("testCase:review.errors.inputRequired")),
        expectedOutput: z
          .string()
          .trim()
          .min(1, t("testCase:review.errors.expectedOutputRequired")),
        anonymized: z.boolean(),
      }),
    [t],
  )
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: draft,
  })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const inputMode = useWatch({ control: form.control, name: "inputMode" })
  const anonymized = useWatch({ control: form.control, name: "anonymized" })
  const isBusy = pendingAction !== null || form.formState.isSubmitting
  const { lastUserMessage, earlierTurnCount } = inputDraft

  const replaceInput = (input: string, isAnonymized: boolean) => {
    form.setValue("input", input, { shouldDirty: true, shouldValidate: true })
    form.setValue("anonymized", isAnonymized)
  }

  const handleInputModeChange = async (nextMode: TestCaseInputMode) => {
    form.setValue("inputMode", nextMode)
    if (nextMode === "lastMessage") {
      replaceInput(lastUserMessage, false)
      return
    }
    setPendingAction("drafting")
    try {
      const redrafted = await onDraftInput(nextMode)
      replaceInput(redrafted.input, false)
    } catch {
      form.setError("input", { message: t("testCase:review.errors.draftInput") })
    } finally {
      setPendingAction(null)
    }
  }

  const handleAnonymize = async () => {
    setPendingAction("anonymizing")
    try {
      replaceInput(await onAnonymize(form.getValues("input")), true)
    } catch {
      form.setError("input", { message: t("testCase:review.errors.anonymize") })
    } finally {
      setPendingAction(null)
    }
  }

  const handleValid = async (values: ReviewFormValues) => {
    try {
      await onSave(values)
    } catch {
      form.setError("root", { message: t("testCase:review.errors.save") })
    }
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(handleValid)}>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <Badge variant="outline">
              {judgement.verdict === "good" ? <ThumbsUpIcon /> : <ThumbsDownIcon />}
              {t(`testCase:verdict.${judgement.verdict}.title`)}
            </Badge>
            {t("testCase:review.to")}
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
                  <FormLabel>{t("testCase:review.input")}</FormLabel>
                  {anonymized && (
                    <Badge variant="secondary">{t("testCase:review.anonymized")}</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleAnonymize}
                >
                  {pendingAction === "anonymizing" ? <Spinner /> : <VenetianMaskIcon />}
                  {t("testCase:review.anonymize")}
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
                <ToggleGroupItem value="conversation" disabled={earlierTurnCount === 0}>
                  {pendingAction === "drafting" && <Spinner />}
                  {t("testCase:review.inputModes.conversation")}
                </ToggleGroupItem>
                <ToggleGroupItem value="lastMessage">
                  {t("testCase:review.inputModes.lastMessage")}
                </ToggleGroupItem>
              </ToggleGroup>
              <FormControl>
                <Textarea rows={4} disabled={pendingAction !== null} {...field} />
              </FormControl>
              <FormDescription>{describeInputMode(t, inputMode, earlierTurnCount)}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="expectedOutput"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("testCase:review.expectedOutput")}</FormLabel>
              <FormControl>
                <Textarea rows={6} {...field} />
              </FormControl>
              <FormDescription>
                {t(`testCase:review.expectedOutputHints.${judgement.verdict}`)}
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
            {t("actions:back")}
          </Button>
          <Button type="submit" disabled={isBusy}>
            {form.formState.isSubmitting && <Spinner />}
            {t("testCase:review.save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function describeInputMode(
  t: TFunction,
  inputMode: TestCaseInputMode,
  earlierTurnCount: number,
): string {
  if (earlierTurnCount === 0) return t("testCase:review.inputHints.firstTurn")
  return t(`testCase:review.inputHints.${inputMode}`, { count: earlierTurnCount })
}
