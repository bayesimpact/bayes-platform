import { agentFactory } from "@/common/features/agents/agent.factory"
import { agentSettingsFactory } from "@/common/features/agents/agent-settings/agent-settings.factory"
import { evaluationExtractionDatasetFactory } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.factory"
import { evaluationExtractionRunFactory } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.factory"
import { EvalRoutes } from "@/eval/routes/helpers"
import type { Scenario } from "./types"
import { buildWorkspace, HARNESS_ORGANIZATION_ID, HARNESS_PROJECT_ID } from "./workspace"

const DATASET_ID = "ds-1"

export const evalExtractionDataset: Scenario = {
  description: "Eval extraction dataset page with two agents and one completed run each",
  path: EvalRoutes.extractionDataset.build({
    organizationId: HARNESS_ORGANIZATION_ID,
    projectId: HARNESS_PROJECT_ID,
    datasetId: DATASET_ID,
  }),
  buildFixtures: () => {
    const { project, fixtures } = buildWorkspace({ featureFlags: ["evaluation"] })
    const agents = agentFactory.transient({ project }).buildList(2)
    const settingsByAgentId = Object.fromEntries(
      agents.map((agent) => [
        agent.id,
        [
          agentSettingsFactory
            .transient({ agent })
            .build({ agentId: agent.id, revision: agent.currentRevision.number }),
        ],
      ]),
    )
    const dataset = evaluationExtractionDatasetFactory
      .transient({ project })
      .build({ id: DATASET_ID })
    const runs = agents.map((agent) =>
      evaluationExtractionRunFactory.transient({ dataset, agent }).build({ status: "completed" }),
    )

    return {
      ...fixtures,
      "agents.getAll": agents,
      "agents.getAllWithDrafts": agents,
      "agentSettings.getAll": ({ agentId }: { agentId: string }) =>
        settingsByAgentId[agentId] ?? [],
      "evaluationExtractionDatasets.getAll": [dataset],
      "evaluationExtractionDatasets.getAllFiles": [],
      "evaluationExtractionDatasets.getRecords": { records: [], total: 0, page: 0, limit: 20 },
      "evaluationExtractionRuns.getAll": runs,
    }
  },
}
