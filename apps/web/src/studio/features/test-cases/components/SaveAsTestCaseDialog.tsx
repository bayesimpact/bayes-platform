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
import { AlertCircleIcon } from "lucide-react"
import { useRef, useState } from "react"
import type { EvaluationConversationDataset } from "@/eval/features/evaluation-conversation-datasets/evaluation-conversation-datasets.models"
import type {
  TestCase,
  TestCaseDatasetTarget,
  TestCaseDraft,
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
  | { kind: "review"; judgement: TestCaseJudgement; draft: TestCaseDraft }

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
  onDraftStandaloneQuestion,
  onDraftExpectedOutput,
  onAnonymize,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: TestCaseSource
  datasets: EvaluationConversationDataset[]
  /** Writes a question that carries what the earlier turns established. */
  onDraftStandaloneQuestion: () => Promise<string>
  /** Writes the answer the agent should have given, from the user's critique. */
  onDraftExpectedOutput: (critique: string) => Promise<string>
  /** Strips personal data from a text. */
  onAnonymize: (text: string) => Promise<string>
  onSave: (testCase: TestCase) => Promise<void>
}) {
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
    // With no earlier turn, the last message already holds the whole conversation.
    const inputMode: TestCaseInputMode =
      source.earlierTurnCount > 0 ? "conversation" : "lastMessage"
    try {
      const [input, expectedOutput] = await Promise.all([
        inputMode === "conversation" ? onDraftStandaloneQuestion() : source.lastUserMessage,
        judgement.verdict === "good" ? source.answer : onDraftExpectedOutput(judgement.comment),
      ])
      if (opening !== openingRef.current) return
      setStep({
        kind: "review",
        judgement,
        draft: { inputMode, input, expectedOutput, anonymized: false },
      })
    } catch {
      if (opening !== openingRef.current) return
      setStep({ kind: "draftFailed", judgement })
    }
  }

  const save = async (judgement: TestCaseJudgement, reviewed: TestCaseDraft) => {
    await onSave({ ...judgement, ...reviewed })
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 p-6 pb-4">
          <DialogTitle>Save as test case</DialogTitle>
          <DialogDescription>
            {step.kind === "review"
              ? "Check what the dataset will hold. A run sends the input to the agent and grades its answer against the expected one."
              : "Turn this answer into a test case, replayed every time the dataset runs."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 pb-6">
          {step.kind === "judge" && (
            <TestCaseJudgeStep
              source={source}
              datasets={datasets}
              judgement={step.judgement}
              onCancel={() => handleOpenChange(false)}
              onSubmit={draft}
            />
          )}

          {step.kind === "drafting" && (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
              <Spinner className="size-5" />
              {step.judgement.verdict === "good"
                ? "Drafting the test case…"
                : "Drafting the test case and the answer to aim for…"}
            </div>
          )}

          {step.kind === "draftFailed" && (
            <div className="flex flex-col gap-5">
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>The test case could not be drafted</AlertTitle>
                <AlertDescription>
                  The LLM did not answer. Try again, or go back and change your choices.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setStep({ kind: "judge", judgement: step.judgement })}
                >
                  Back
                </Button>
                <Button onClick={() => draft(step.judgement)}>Try again</Button>
              </DialogFooter>
            </div>
          )}

          {step.kind === "review" && (
            <TestCaseReviewStep
              source={source}
              judgement={step.judgement}
              datasetName={targetName(step.judgement.target, datasets)}
              draft={step.draft}
              onDraftStandaloneQuestion={onDraftStandaloneQuestion}
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
  target: TestCaseDatasetTarget,
  datasets: EvaluationConversationDataset[],
): string {
  if (target.kind === "new") return `${target.name} (new)`
  return datasets.find((dataset) => dataset.id === target.datasetId)?.name ?? ""
}
