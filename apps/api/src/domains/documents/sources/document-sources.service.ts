import { Injectable, NotFoundException } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { DocumentSource } from "./document-source.entity"
import type {
  CreateDocumentSourceFields,
  UpdateDocumentSourceFields,
} from "./document-source.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentSourceRepository } from "./document-source.repository"

@Injectable()
export class DocumentSourcesService {
  constructor(private readonly documentSourceRepository: DocumentSourceRepository) {}

  getAll(
    connectScope: RequiredConnectScope,
    filters?: { externalId?: string },
  ): Promise<DocumentSource[]> {
    return this.documentSourceRepository.list(connectScope, filters)
  }

  getOne(connectScope: RequiredConnectScope, id: string): Promise<DocumentSource | null> {
    return this.documentSourceRepository.findOne(connectScope, id)
  }

  createOne(
    connectScope: RequiredConnectScope,
    fields: CreateDocumentSourceFields,
  ): Promise<DocumentSource> {
    return this.documentSourceRepository.createOne(connectScope, fields)
  }

  async updateOne(
    connectScope: RequiredConnectScope,
    id: string,
    fields: UpdateDocumentSourceFields,
  ): Promise<DocumentSource> {
    const documentSource = await this.documentSourceRepository.updateOne(connectScope, id, fields)
    if (!documentSource) {
      throw new NotFoundException(`Document source ${id} not found`)
    }
    return documentSource
  }

  async deleteOne(connectScope: RequiredConnectScope, id: string): Promise<void> {
    const deleted = await this.documentSourceRepository.deleteOne(connectScope, id)
    if (!deleted) {
      throw new NotFoundException(`Document source ${id} not found`)
    }
  }
}
