import {
  type DatasetNameInputDto,
  EvalExtractionDatasetsRoutes,
  EXTRACTION_DATASET_FILE_MIME_TYPE,
  type ExtractionDatasetParamsDto,
  type ExtractionDatasetSetupInputDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { EXTRACTION_RUNS_QUERY_KEY } from "@/lib/run-query-keys"
import { putFileToSignedUrl } from "@/lib/upload-file"
import { extractionDatasetKeys } from "./keys"

/** Creates a dataset with no record, then loads the project's list again. */
export function useCreateExtractionDataset(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: DatasetNameInputDto) =>
      apiRequest(EvalExtractionDatasetsRoutes.createOne, { params: project, body }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.ofProject(project) }),
  })
}

/** Renames a dataset, then loads the project's list again. */
export function useRenameExtractionDataset(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ datasetId, name }: { datasetId: string; name: string }) =>
      apiRequest(EvalExtractionDatasetsRoutes.renameOne, {
        params: { ...project, datasetId },
        body: { name },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.ofProject(project) }),
  })
}

/**
 * Deletes a dataset with its records: its own queries go, so a step back does not show it. The
 * API deletes its runs with it, so the runs load again too.
 */
export function useDeleteExtractionDataset(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datasetId: string) =>
      apiRequest(EvalExtractionDatasetsRoutes.deleteOne, { params: { ...project, datasetId } }),
    onSuccess: (_answer, datasetId) =>
      queryClient.removeQueries({
        queryKey: extractionDatasetKeys.records({ ...project, datasetId }),
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.ofProject(project) }),
        queryClient.invalidateQueries({ queryKey: EXTRACTION_RUNS_QUERY_KEY }),
      ]),
  })
}

/**
 * Builds the records of a dataset from a file, with the name and the role of each column, then
 * loads the dataset and its records again.
 */
export function useSetUpExtractionDataset(dataset: ExtractionDatasetParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      documentId,
      ...body
    }: ExtractionDatasetSetupInputDto & { documentId: string }) =>
      apiRequest(EvalExtractionDatasetsRoutes.setUpOne, {
        params: { ...dataset, documentId },
        body,
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.records(dataset) }),
        queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.ofProject(dataset) }),
      ]),
  })
}

/**
 * Uploads a CSV file to a project: the API signs a URL, the bytes go to the storage, then the API
 * lists the file.
 */
export function useUploadExtractionFile(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { documentId, uploadUrl } = await apiRequest(EvalExtractionDatasetsRoutes.presignFile, {
        params: project,
        body: { fileName: file.name, mimeType: EXTRACTION_DATASET_FILE_MIME_TYPE, size: file.size },
      })
      await putFileToSignedUrl(uploadUrl, file, EXTRACTION_DATASET_FILE_MIME_TYPE)
      return apiRequest(EvalExtractionDatasetsRoutes.confirmFile, {
        params: { ...project, documentId },
      })
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.files(project) }),
  })
}

/**
 * Deletes CSV files of a project, all at once. A dataset already built from one of them keeps
 * its records.
 */
export function useDeleteExtractionFiles(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentIds: string[]) =>
      Promise.all(
        documentIds.map((documentId) =>
          apiRequest(EvalExtractionDatasetsRoutes.deleteFile, {
            params: { ...project, documentId },
          }),
        ),
      ),
    // The columns of a deleted file go with it.
    onSuccess: (_answer, documentIds) => {
      for (const documentId of documentIds) {
        queryClient.removeQueries({
          queryKey: extractionDatasetKeys.fileColumns(project, documentId),
        })
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.files(project) }),
  })
}
