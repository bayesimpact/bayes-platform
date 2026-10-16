import type { AgentModel } from "@caseai-connect/api-contracts"

/** The fields of the dialog that starts a conversation evaluation run. */
export type RunFormValues = {
  agentId: string
  // null = no explicit choice yet; the newest revision is used once history loads.
  selectedRevision: number | null
  judgeModel: AgentModel
  judgeInstructions: string
  runScope: "all" | "limited"
  limitedCount: number
}

/** A fresh form: no agent, the whole dataset, judged by the catalog's default judge. */
export function buildDefaultRunFormValues(defaultJudgeModel: AgentModel): RunFormValues {
  return {
    agentId: "",
    selectedRevision: null,
    judgeModel: defaultJudgeModel,
    judgeInstructions: "",
    runScope: "all",
    limitedCount: 1,
  }
}

/**
 * The run to create from the dialog: blank judge instructions are sent as none, and the
 * record limit only applies to a limited run. Undefined until a revision is picked.
 */
export function buildCreateRunPayload({
  datasetId,
  values,
}: {
  datasetId: string
  values: RunFormValues
}):
  | {
      datasetId: string
      agentId: string
      agentSettingsRevision: number
      judgeModel: AgentModel
      judgeInstructions: string | null
      recordLimit: number | null
    }
  | undefined {
  if (values.selectedRevision === null) return undefined
  return {
    datasetId,
    agentId: values.agentId,
    agentSettingsRevision: values.selectedRevision,
    judgeModel: values.judgeModel,
    judgeInstructions: values.judgeInstructions.trim() || null,
    recordLimit: values.runScope === "limited" ? values.limitedCount : null,
  }
}

// Last 6 chars of the run id (e.g. "894f5f5b-...-a3b4b3837502" -> "837502"): a short,
// human-readable handle to tell runs apart when their agent/version/model match.
// 6 hex chars keep collisions negligible for the handful of runs a dataset has.
export function shortRunId(runId: string): string {
  return runId.slice(-6)
}
