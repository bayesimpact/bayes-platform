import type { AgentParamsDto } from "@caseai-connect/desk-contracts"
import {
  type CsvColumnDto,
  DeskCsvExtractionsRoutes,
  DeskDocumentsRoutes,
  DeskExtractionsRoutes,
  presignExtractionDocumentInputSchema,
} from "@caseai-connect/desk-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { invalidateAgentHistory } from "@/features/history"
import { apiRequest } from "@/lib/api-client"
import { openInTab } from "@/lib/safe-url"
import { putFileToSignedUrl } from "@/lib/upload-file"
import { extractionMimeTypeOf } from "../extraction-files"
import { extractionKeys } from "./keys"
import { csvRunQueryOptions } from "./queries"

/** What a new file starts: the extraction of a document, or the setup of a CSV file's run. */
export type StartedExtraction = { kind: "run"; runId: string } | { kind: "csv"; documentId: string }

/** Where an upload stands, which the page tells the person. */
export type UploadStep = "uploading" | "starting"

/**
 * Uploads a file for an extraction, then starts it: a document runs at once; a CSV file waits for
 * the person to choose what the agent reads in its rows. Aborting `signal` stops it at any step.
 */
export function useUploadAndExtract(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  const params = agent
  return useMutation({
    mutationFn: async ({
      file,
      onStep,
      signal,
    }: {
      file: File
      onStep: (step: UploadStep) => void
      signal: AbortSignal
    }): Promise<StartedExtraction> => {
      const mimeType = extractionMimeTypeOf(file)
      if (!mimeType) throw new Error("An extraction cannot read this type of file")
      onStep("uploading")
      const { documentId, uploadUrl } = await apiRequest(DeskExtractionsRoutes.presignDocument, {
        params,
        body: presignExtractionDocumentInputSchema.parse({
          file: { fileName: file.name, mimeType, size: file.size },
        }),
        signal,
      })
      await putFileToSignedUrl(uploadUrl, file, mimeType, signal)
      await apiRequest(DeskExtractionsRoutes.confirmDocument, {
        params,
        body: { documentId },
        signal,
      })
      if (mimeType === "text/csv") return { kind: "csv", documentId }
      onStep("starting")
      const { runId } = await apiRequest(DeskExtractionsRoutes.executeOne, {
        params,
        body: { documentId },
        signal,
      })
      return { kind: "run", runId }
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Extracts again a document the person uploaded before. */
export function useExtractDocument(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) =>
      (
        await apiRequest(DeskExtractionsRoutes.executeOne, {
          params: agent,
          body: { documentId },
        })
      ).runId,
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Deletes a document the person uploaded; its past extractions stay. */
export function useDeleteExtractionDocument(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      apiRequest(DeskExtractionsRoutes.deleteMyDocument, {
        params: { ...agent, documentId },
      }),
    // The document's own queries go with it, such as its CSV columns, kept for good: a step back
    // in the browser would otherwise show the setup of a file that no longer exists.
    onSuccess: (_, documentId) => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey.includes(documentId) })
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Creates the run of a CSV file with the columns' roles, then starts it. */
export function useStartCsvExtraction(agent: AgentParamsDto) {
  const queryClient = useQueryClient()
  const params = agent
  return useMutation({
    mutationFn: async ({
      csvDocumentId,
      columnSchema,
      recordLimit,
    }: {
      csvDocumentId: string
      columnSchema: Record<string, CsvColumnDto>
      recordLimit: number | null
    }) => {
      const created = await apiRequest(DeskCsvExtractionsRoutes.createOne, {
        params,
        body: { csvDocumentId, columnSchema },
      })
      return apiRequest(DeskCsvExtractionsRoutes.executeOne, {
        params: { ...params, agentCsvExtractionRunId: created.id },
        body: { recordLimit },
      })
    },
    // The run's page opens on the run the API just answered, without asking for it again.
    onSuccess: (run) => {
      queryClient.setQueryData(csvRunQueryOptions(agent, run.id).queryKey, run)
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/**
 * Stops a CSV run, or starts it again: the page shows the run as the API answers it, and its rows
 * refresh, since the action changed them.
 */
function useCsvRunAction(
  agent: AgentParamsDto,
  route: typeof DeskCsvExtractionsRoutes.cancelOne | typeof DeskCsvExtractionsRoutes.retryOne,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (csvRunId: string) =>
      apiRequest(route, { params: { ...agent, agentCsvExtractionRunId: csvRunId } }),
    onSuccess: (run) => {
      queryClient.setQueryData(csvRunQueryOptions(agent, run.id).queryKey, run)
    },
    onSettled: (_run, _error, csvRunId) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: extractionKeys.csvRunRecords(agent.agentId, csvRunId),
        }),
        invalidateAgentHistory(queryClient, agent.agentId),
      ]),
  })
}

/** Stops a CSV run: the rows already done stay, and the results file gets them. */
export const useCancelCsvExtraction = (agent: AgentParamsDto) =>
  useCsvRunAction(agent, DeskCsvExtractionsRoutes.cancelOne)

/** Runs a failed CSV extraction again, on the same rows and settings. */
export const useRetryCsvExtraction = (agent: AgentParamsDto) =>
  useCsvRunAction(agent, DeskCsvExtractionsRoutes.retryOne)

/**
 * Opens a file in a new tab: the document an extraction read, or the results of a CSV run. The
 * tab opens during the click and goes to the file once its short-lived URL arrives.
 */
export function useOpenExtractionFile(agent: AgentParamsDto) {
  return useMutation({
    mutationFn: ({
      file,
      tab,
    }: {
      file: { kind: "document"; documentId: string } | { kind: "csvResults"; csvRunId: string }
      tab: Window | null
    }) =>
      openInTab(tab, async () => {
        const params = agent
        const { url } =
          file.kind === "document"
            ? await apiRequest(DeskDocumentsRoutes.getTemporaryUrl, {
                params: { ...params, documentId: file.documentId },
              })
            : await apiRequest(DeskCsvExtractionsRoutes.getExportTemporaryUrl, {
                params: { ...params, agentCsvExtractionRunId: file.csvRunId },
              })
        return url
      }),
  })
}
