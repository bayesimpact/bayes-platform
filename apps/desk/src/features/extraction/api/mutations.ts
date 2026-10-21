import {
  type CsvColumnDto,
  type CsvExtractionRunDetailOutputDto,
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
import { agentParamsOf, type ExtractionAgentRef } from "../extraction-agent"
import { extractionMimeTypeOf } from "../extraction-files"
import { extractionKeys } from "./keys"

/** What a new file starts: the extraction of a document, or the setup of a CSV file's run. */
export type StartedExtraction = { kind: "run"; runId: string } | { kind: "csv"; documentId: string }

/** Where an upload stands, which the page tells the person. */
export type UploadStep = "uploading" | "starting"

/**
 * Uploads a file for an extraction, then starts it: a document runs at once; a CSV file waits for
 * the person to choose what the agent reads in its rows.
 */
export function useUploadAndExtract(agent: ExtractionAgentRef) {
  const queryClient = useQueryClient()
  const params = agentParamsOf(agent)
  return useMutation({
    mutationFn: async ({
      file,
      onStep,
    }: {
      file: File
      onStep: (step: UploadStep) => void
    }): Promise<StartedExtraction> => {
      const mimeType = extractionMimeTypeOf(file)
      if (!mimeType) throw new Error("An extraction cannot read this type of file")
      onStep("uploading")
      const { documentId, uploadUrl } = await apiRequest(DeskExtractionsRoutes.presignDocument, {
        params,
        body: presignExtractionDocumentInputSchema.parse({
          file: { fileName: file.name, mimeType, size: file.size },
        }),
      })
      await putFileToSignedUrl(uploadUrl, file, mimeType)
      await apiRequest(DeskExtractionsRoutes.confirmDocument, { params, body: { documentId } })
      if (mimeType === "text/csv") return { kind: "csv", documentId }
      onStep("starting")
      const { runId } = await apiRequest(DeskExtractionsRoutes.executeOne, {
        params,
        body: { documentId },
      })
      return { kind: "run", runId }
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Extracts again a document the person uploaded before. */
export function useExtractDocument(agent: ExtractionAgentRef) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) =>
      (
        await apiRequest(DeskExtractionsRoutes.executeOne, {
          params: agentParamsOf(agent),
          body: { documentId },
        })
      ).runId,
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Deletes a document the person uploaded; its past extractions stay. */
export function useDeleteExtractionDocument(agent: ExtractionAgentRef) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      apiRequest(DeskExtractionsRoutes.deleteMyDocument, {
        params: { ...agentParamsOf(agent), documentId },
      }),
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Creates the run of a CSV file with the columns' roles, then starts it. */
export function useStartCsvExtraction(agent: ExtractionAgentRef) {
  const queryClient = useQueryClient()
  const params = agentParamsOf(agent)
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
      const run = await apiRequest(DeskCsvExtractionsRoutes.executeOne, {
        params: { ...params, agentCsvExtractionRunId: created.id },
        body: { recordLimit },
      })
      queryClient.setQueryData(extractionKeys.csvRun(agent.agentId, run.id), run)
      return run.id
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Stops a CSV run, or starts it again, and shows the run as the API answers it. */
function useCsvRunAction(
  agent: ExtractionAgentRef,
  route: typeof DeskCsvExtractionsRoutes.cancelOne | typeof DeskCsvExtractionsRoutes.retryOne,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (csvRunId: string) =>
      apiRequest(route, { params: { ...agentParamsOf(agent), agentCsvExtractionRunId: csvRunId } }),
    onSuccess: (run: CsvExtractionRunDetailOutputDto) => {
      queryClient.setQueryData(extractionKeys.csvRun(agent.agentId, run.id), run)
      void queryClient.invalidateQueries({ queryKey: extractionKeys.csvRun(agent.agentId, run.id) })
    },
    onSettled: () => invalidateAgentHistory(queryClient, agent.agentId),
  })
}

/** Stops a CSV run: the rows already done stay, and the results file gets them. */
export const useCancelCsvExtraction = (agent: ExtractionAgentRef) =>
  useCsvRunAction(agent, DeskCsvExtractionsRoutes.cancelOne)

/** Runs a failed CSV extraction again, on the same rows and settings. */
export const useRetryCsvExtraction = (agent: ExtractionAgentRef) =>
  useCsvRunAction(agent, DeskCsvExtractionsRoutes.retryOne)

/**
 * Opens a file in a new tab: the document an extraction read, or the results of a CSV run. The
 * tab opens during the click and goes to the file once its short-lived URL arrives.
 */
export function useOpenExtractionFile(agent: ExtractionAgentRef) {
  return useMutation({
    mutationFn: ({
      file,
      tab,
    }: {
      file: { kind: "document"; documentId: string } | { kind: "csvResults"; csvRunId: string }
      tab: Window | null
    }) =>
      openInTab(tab, async () => {
        const params = agentParamsOf(agent)
        const { url } =
          file.kind === "document"
            ? await apiRequest(DeskDocumentsRoutes.getTemporaryUrl, {
                params: {
                  organizationId: params.organizationId,
                  projectId: params.projectId,
                  documentId: file.documentId,
                },
              })
            : await apiRequest(DeskCsvExtractionsRoutes.getExportTemporaryUrl, {
                params: { ...params, agentCsvExtractionRunId: file.csvRunId },
              })
        return url
      }),
  })
}
