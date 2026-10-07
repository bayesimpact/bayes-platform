import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@caseai-connect/ui/shad/questionnaire"
import { BrainIcon } from "lucide-react"
import type { FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  decisionsFromAnswers,
  MEMORY_DECISION_REJECT,
  MEMORY_DECISION_SAVE,
  parseSaveMemoryResult,
} from "../agent-memories.helpers"
import type { AgentMemoryToolItem } from "../agent-memories.models"
import { selectAgentMemoryStatusById } from "../agent-memories.selectors"
import { resolveAgentMemoryProposals } from "../agent-memories.thunks"

type ToolCall = { id: string; result?: unknown }

/**
 * Under an assistant message that called saveMemory: the facts saved at once,
 * and an approval questionnaire for the facts the agent proposed (ADR 0023).
 * Each proposal's current status comes from the memory slice, so an answered
 * proposal shows its outcome after a reload too.
 */
export function MemoryToolCard({ toolCall }: { toolCall: ToolCall }) {
  const { t } = useTranslation()
  const statusById = useAppSelector(selectAgentMemoryStatusById)
  const items = parseSaveMemoryResult(toolCall.result)
  // No memory slice (tester) or not loaded yet: nothing reliable to show.
  if (!statusById || items.length === 0) return null

  const saved = items.filter((item) => item.status === "saved")
  const proposals = items.filter((item) => item.status === "pending")
  const stillPending = proposals.filter((item) => statusById[item.id] === "pending")
  const answered = proposals.filter((item) => statusById[item.id] !== "pending")

  return (
    <div className="mt-2 flex w-full flex-col gap-2">
      {[...saved, ...answered].map((item) => (
        <MemoryOutcome
          key={item.id}
          item={item}
          kept={statusById[item.id] === "saved"}
          label={
            item.status === "saved"
              ? t("agentMemories:card.saved")
              : statusById[item.id] === "saved"
                ? t("agentMemories:card.answeredSaved")
                : t("agentMemories:card.answeredRejected")
          }
        />
      ))}
      {stillPending.length > 0 && <MemoryProposalForm proposals={stillPending} />}
    </div>
  )
}

function MemoryOutcome({
  item,
  kept,
  label,
}: {
  item: AgentMemoryToolItem
  kept: boolean
  label: string
}) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <BrainIcon className="mt-0.5 size-3.5 shrink-0" />
      <Badge variant={kept ? "secondary" : "outline"}>{label}</Badge>
      <span className={kept ? "" : "line-through"}>{item.content}</span>
    </div>
  )
}

function MemoryProposalForm({ proposals }: { proposals: AgentMemoryToolItem[] }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const answers = new FormData(event.currentTarget)
    const decisions = decisionsFromAnswers(proposals, (memoryId) =>
      answers.getAll(memoryId).map(String),
    )
    if (decisions.length > 0) dispatch(resolveAgentMemoryProposals({ decisions }))
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <Questionnaire onSubmit={handleSubmit}>
        {proposals.length > 1 && <QuestionnaireProgress />}
        {proposals.map((proposal) => (
          <QuestionnaireItem key={proposal.id} name={proposal.id}>
            <QuestionnaireTitle>{t("agentMemories:card.proposalTitle")}</QuestionnaireTitle>
            <QuestionnaireDescription>
              <span className="font-medium text-foreground">{proposal.content}</span>
              <br />
              {t("agentMemories:card.proposalDescription")}
            </QuestionnaireDescription>
            <QuestionnaireChoices>
              <QuestionnaireChoice value={MEMORY_DECISION_SAVE}>
                {t("agentMemories:card.save")}
              </QuestionnaireChoice>
              <QuestionnaireChoice value={MEMORY_DECISION_REJECT}>
                {t("agentMemories:card.reject")}
              </QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireInput
              aria-label={t("agentMemories:card.rewordLabel")}
              placeholder={t("agentMemories:card.rewordPlaceholder")}
            />
          </QuestionnaireItem>
        ))}
        <QuestionnaireActions>
          <QuestionnaireSkip>{t("agentMemories:card.skip")}</QuestionnaireSkip>
          <QuestionnaireNext>{t("actions:next")}</QuestionnaireNext>
          <QuestionnaireSubmit>{t("agentMemories:card.submit")}</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  )
}
