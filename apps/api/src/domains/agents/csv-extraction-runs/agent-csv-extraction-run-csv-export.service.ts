import { Inject, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConnectRepository } from "@/common/entities/connect-repository"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
import {
  FILE_STORAGE_SERVICE,
  type IFileStorage,
} from "@/domains/documents/storage/file-storage.interface"
import { AgentCsvExtractionRun } from "./agent-csv-extraction-run.entity"
import {
  buildAgentCsvExtractionRunCsv,
  buildAgentCsvExtractionRunCsvFileName,
} from "./agent-csv-extraction-run-csv-builder"
import { AgentCsvExtractionRunRecord } from "./agent-csv-extraction-run-record.entity"

const CSV_MIME_TYPE = "text/csv"
const CSV_EXTENSION = "csv"

@Injectable()
export class AgentCsvExtractionRunCsvExportService {
  private readonly runRecordConnectRepository: ConnectRepository<AgentCsvExtractionRunRecord>
  private readonly runRepository: Repository<AgentCsvExtractionRun>

  constructor(
    @InjectRepository(AgentCsvExtractionRun)
    runRepository: Repository<AgentCsvExtractionRun>,
    @InjectRepository(AgentCsvExtractionRunRecord)
    runRecordRepository: Repository<AgentCsvExtractionRunRecord>,
    @Inject(FILE_STORAGE_SERVICE)
    private readonly fileStorageService: IFileStorage,
    private readonly documentsService: DocumentsService,
  ) {
    this.runRecordConnectRepository = new ConnectRepository(
      runRecordRepository,
      "agentCsvExtractionRunRecord",
    )
    this.runRepository = runRepository
  }

  async generateAndStoreDocument(run: AgentCsvExtractionRun): Promise<void> {
    const connectScope: RequiredConnectScope = {
      organizationId: run.organizationId,
      projectId: run.projectId,
    }

    const records = await this.runRecordConnectRepository.find(connectScope, {
      where: { agentCsvExtractionRunId: run.id },
      order: { rowIndex: "ASC" },
    })

    const csvBuffer = buildAgentCsvExtractionRunCsv({ run, records })
    const fileName = buildAgentCsvExtractionRunCsvFileName({ runId: run.id })

    const fileInfo = await this.fileStorageService.save({
      connectScope,
      extension: CSV_EXTENSION,
      file: {
        buffer: csvBuffer,
        mimetype: CSV_MIME_TYPE,
        originalname: fileName,
        size: csvBuffer.byteLength,
      } as MulterFile,
    })

    const document = await this.documentsService.createDocument({
      connectScope,
      documentId: fileInfo.fileId,
      uploadStatus: "uploaded",
      fields: {
        fileName,
        mimeType: CSV_MIME_TYPE,
        size: csvBuffer.byteLength,
        storageRelativePath: fileInfo.storageRelativePath,
        title: fileName,
        sourceType: "agentCsvExtractionRun",
      },
    })

    await this.runRepository.update(run.id, { csvExportDocumentId: document.id })
    run.csvExportDocumentId = document.id
  }
}
