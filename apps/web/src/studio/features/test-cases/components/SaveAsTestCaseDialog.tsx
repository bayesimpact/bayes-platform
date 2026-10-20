import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import type { TFunction } from "i18next"
import { AlertCircleIcon } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { EvaluationConversationDataset } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import type {
  TestCase,
  TestCaseDatasetTarget,
  TestCaseDraft,
  TestCaseInputDraft,
  TestCaseInputMode,
  TestCaseJudgement,
  TestCaseSource,
} from "../test-cases.models"
import { TestCaseJudgeStep } from "./TestCaseJudgeStep"
import { TestCaseReviewStep } from "./TestCaseReviewStep"

type DialogStep =
  | { kind: "judge"; judgement: TestCaseJudgement | null }
  | { kind: "drafting"; judgement: TestCaseJudgement }
  | { kind: "draftFailed"; judgement: TestCaseJudgement }
  | {
      kind: "review"
      judgement: TestCaseJudgement
      inputDraft: TestCaseInputDraft
      draft: TestCaseDraft
    }

const FIRST_STEP: DialogStep = { kind: "judge", judgement: null }

/**
 * Turns an agent answer into a record of a conversation dataset, in two steps: the user judges
 * the answer, then reviews the input and expected output an LLM proposes. The LLM calls and the
 * save are callbacks, so the dialog stays free of any API.
 */
export function SaveAsTestCaseDialog({
  open,
  onOpenChange,
  source,
  datasets,
  canCreateDataset,
  onDraftInput,
  onDraftExpectedOutput,
  onAnonymize,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: TestCaseSource
  datasets: EvaluationConversationDataset[]
  canCreateDataset: boolean
  /** Drafts the input in a mode, or with none, in the one that suits the conversation. */
  onDraftInput: (inputMode: TestCaseInputMode | null) => Promise<TestCaseInputDraft>
  /** Writes the answer the agent should have given, from what is wrong with it. */
  onDraftExpectedOutput: (comment: string) => Promise<string>
  /** Strips personal data from a text. */
  onAnonymize: (text: string) => Promise<string>
  onSave: (testCase: TestCase, datasetName: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState<DialogStep>(FIRST_STEP)
  // Bumped on close, so a draft that lands after the dialog closed is dropped.
  const openingRef = useRef(0)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      openingRef.current += 1
      setStep(FIRST_STEP)
    }
    onOpenChange(nextOpen)
  }

  const draft = async (judgement: TestCaseJudgement) => {
    const opening = openingRef.current
    setStep({ kind: "drafting", judgement })
    try {
      const [inputDraft, expectedOutput] = await Promise.all([
        onDraftInput(null),
        judgement.verdict === "good" ? source.answer : onDraftExpectedOutput(judgement.comment),
      ])
      if (opening !== openingRef.current) return
      setStep({
        kind: "review",
        judgement,
        inputDraft,
        draft: {
          inputMode: inputDraft.inputMode,
          input: inputDraft.input,
          expectedOutput,
          anonymized: false,
        },
      })
    } catch {
      if (opening !== openingRef.current) return
      setStep({ kind: "draftFailed", judgement })
    }
  }

  const save = async (judgement: TestCaseJudgement, reviewed: TestCaseDraft) => {
    const { target } = judgement
    await onSave(
      { ...judgement, ...reviewed },
      target.kind === "new" ? target.name : existingDatasetName(target.datasetId, datasets),
    )
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 p-6 pb-4">
          <DialogTitle>{t("testCase:saveAsTestCase")}</DialogTitle>
          <DialogDescription>
            {step.kind === "review"
              ? t("testCase:dialog.reviewDescription")
              : t("testCase:dialog.judgeDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 pb-6">
          {step.kind === "judge" && (
            <TestCaseJudgeStep
              source={source}
              datasets={datasets}
              canCreateDataset={canCreateDataset}
              judgement={step.judgement}
              onCancel={() => handleOpenChange(false)}
              onSubmit={draft}
            />
          )}

          {step.kind === "drafting" && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
              <Spinner className="size-5" />
              {step.judgement.verdict === "good"
                ? t("testCase:dialog.drafting")
                : t("testCase:dialog.draftingWithExpectedOutput")}
            </div>
          )}

          {step.kind === "draftFailed" && (
            <div className="flex flex-col gap-5">
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>{t("testCase:dialog.draftFailedTitle")}</AlertTitle>
                <AlertDescription>{t("testCase:dialog.draftFailedDescription")}</AlertDescription>
              </Alert>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setStep({ kind: "judge", judgement: step.judgement })}
                >
                  {t("actions:back")}
                </Button>
                <Button onClick={() => draft(step.judgement)}>{t("actions:retry")}</Button>
              </DialogFooter>
            </div>
          )}

          {step.kind === "review" && (
            <TestCaseReviewStep
              judgement={step.judgement}
              datasetName={targetName(t, step.judgement.target, datasets)}
              inputDraft={step.inputDraft}
              draft={step.draft}
              onDraftInput={onDraftInput}
              onAnonymize={onAnonymize}
              onBack={() => setStep({ kind: "judge", judgement: step.judgement })}
              onSave={(reviewed) => save(step.judgement, reviewed)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function targetName(
  t: TFunction,
  target: TestCaseDatasetTarget,
  datasets: EvaluationConversationDataset[],
): string {
  if (target.kind === "new") return t("testCase:dataset.newDatasetSuffix", { name: target.name })
  return existingDatasetName(target.datasetId, datasets)
}

function existingDatasetName(datasetId: string, datasets: EvaluationConversationDataset[]) {
  return datasets.find((dataset) => dataset.id === datasetId)?.name ?? ""
}
