import { Column, JoinColumn, ManyToOne, type Relation } from "typeorm"
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
  evaluationConversationDataset!: Relation<EvaluationConversationDataset>

  @Column({ name: "input", nullable: false, type: "text" })
  input!: string

  @Column({ name: "expected_output", nullable: false, type: "text" })
  expectedOutput!: string

  // Why the expected output is the reference, when the record was saved from an agent answer.
  @Column({ name: "comment", nullable: true, type: "text" })
  comment!: string | null
}
