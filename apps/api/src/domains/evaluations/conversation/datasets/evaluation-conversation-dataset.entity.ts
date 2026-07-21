import { Column, OneToMany } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { EvaluationConversationDatasetRecord } from "./records/evaluation-conversation-dataset-record.entity"

@ConnectEntity("evaluation_conversation_dataset")
export class EvaluationConversationDataset extends ConnectEntityBase {
  @Column({ name: "name", nullable: false })
  name!: string

  @OneToMany(
    () => EvaluationConversationDatasetRecord,
    (record) => record.evaluationConversationDataset,
  )
  records!: EvaluationConversationDatasetRecord[]
}
