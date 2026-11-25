import type {
  ConversationDatasetOutputDto,
  ConversationDatasetRecordOutputDto,
} from "@bayes-platform/eval-contracts"
import type { EvaluationConversationDatasetsService } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-datasets.service"

type ConversationDataset = Awaited<
  ReturnType<EvaluationConversationDatasetsService["listDatasets"]>
>[number]

type ConversationDatasetRecord = Awaited<
  ReturnType<EvaluationConversationDatasetsService["listDatasetRecordsPaginated"]>
>["records"][number]

/** A copy of `toEvaluationConversationDatasetDto`, with the fields Evaluation reads. */
export function toConversationDatasetDto({
  dataset,
  recordCount,
}: {
  dataset: ConversationDataset
  recordCount: number
}): ConversationDatasetOutputDto {
  return {
    id: dataset.id,
    name: dataset.name,
    recordCount,
    updatedAt: dataset.updatedAt.getTime(),
  }
}

/** A record of a dataset, with the fields Evaluation reads. */
export function toConversationDatasetRecordDto(
  record: ConversationDatasetRecord,
): ConversationDatasetRecordOutputDto {
  return {
    id: record.id,
    input: record.input,
    expectedOutput: record.expectedOutput,
    comment: record.comment,
  }
}
