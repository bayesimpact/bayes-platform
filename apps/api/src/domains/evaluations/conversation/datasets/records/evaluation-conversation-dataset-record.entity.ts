import { Column, JoinColumn, ManyToOne } from "typeorm"
import { ConnectEntity, ConnectEntityBase } from "@/common/entities/connect-entity"
import { EvaluationConversationDataset } from "../evaluation-conversation-dataset.entity"

@ConnectEntity("evaluation_conversation_dataset_record")
export class EvaluationConversationDatasetRecord extends ConnectEntityBase {
  @Column({ type: "uuid", name: "evaluation_conversation_dataset_id", nullable: false })
  evaluationConversationDatasetId!: string
  @ManyToOne(
    () => EvaluationConversationDataset,
    (evaluationConversationDataset) => evaluationConversationDataset.records,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "evaluation_conversation_dataset_id" })
  evaluationConversationDataset!: EvaluationConversationDataset

  @Column({ name: "input", nullable: false, type: "text" })
  input!: string

  @Column({ name: "expected_output", nullable: false, type: "text" })
  expectedOutput!: string
}
