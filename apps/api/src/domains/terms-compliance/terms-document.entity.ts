import type { TermsDocumentType } from "@caseai-connect/api-contracts"
import { Column, Entity, Index } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"

@Entity("terms_document")
@Index(["type"], { unique: true, where: '"deleted_at" IS NULL' })
export class TermsDocument extends Base4AllEntity {
  @Column({ type: "varchar" })
  type!: TermsDocumentType

  @Column({ type: "varchar" })
  url!: string

  @Column({ type: "integer" })
  version!: number
}
