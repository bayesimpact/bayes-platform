import {
  EvalExtractionDatasetsRoutes,
  EXTRACTION_DATASET_FILE_MIME_TYPE,
  type ExtractionDatasetParamsDto,
  type ExtractionDatasetSetupInputDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { putFileToSignedUrl } from "@/lib/upload-file"
import { extractionDatasetKeys } from "./keys"

/** Creates a dataset with no record, then loads the project's list again. */
export function useCreateExtractionDataset(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string }) =>
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

/** Deletes a dataset with its records: its own queries go, so a step back does not show it. */
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
      queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.ofProject(project) }),
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

/** Deletes a CSV file of a project. A dataset already built from it keeps its records. */
export function useDeleteExtractionFile(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      apiRequest(EvalExtractionDatasetsRoutes.deleteFile, { params: { ...project, documentId } }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: extractionDatasetKeys.files(project) }),
  })
}
