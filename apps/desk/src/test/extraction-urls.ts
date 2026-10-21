import type { DeskWorld } from "./factories/desk-world.factory"

/** The URLs of the extraction agent of a world: its new extraction, and its runs by file name. */
export function extractionUrlsOf(world: DeskWorld) {
  const [reader] = world.agents
  const agentId = reader?.id ?? ""
  const agentUrl = `/app/o/${world.organizations[0]?.id}/p/${reader?.projectId}/a/${agentId}`
  const runOf = (fileName: string) =>
    (world.extractionRuns[agentId] ?? []).find((run) => run.documentFileName === fileName)
  const documentOf = (fileName: string) =>
    (world.extractionDocuments[agentId] ?? []).find((document) => document.fileName === fileName)
  const [csvRun] = world.csvExtractionRuns[agentId] ?? []
  return {
    agentId,
    newExtractionUrl: `${agentUrl}/extraction`,
    runUrl: (fileName: string) => `${agentUrl}/extraction/runs/${runOf(fileName)?.id}`,
    csvSetupUrl: (fileName: string) => `${agentUrl}/extraction/csv/${documentOf(fileName)?.id}`,
    csvRunUrl: `${agentUrl}/extraction/csv-runs/${csvRun?.id}`,
  }
}
