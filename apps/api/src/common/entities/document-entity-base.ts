import { Column } from "typeorm"
import { ConnectEntityBase } from "@/common/entities/connect-entity"

/**
 * Shared shape of a file stored in the project bucket: chat attachments, evaluation
 * dataset files and any future project-scoped file table extend it.
 *
 * `Document` does not: its file columns are nullable because crawled and inline
 * documents carry their content in the row and have no stored file.
 */
export abstract class DocumentEntityBase extends ConnectEntityBase {
  /** The original name of the file as uploaded. */
  @Column({ type: "varchar", name: "file_name" })
  fileName!: string

  @Column({ type: "varchar", name: "mime_type" })
  mimeType!: string

  /** Size in bytes. */
  @Column({ type: "integer" })
  size!: number

  @Column({ type: "varchar", name: "storage_relative_path" })
  storageRelativePath!: string
}
