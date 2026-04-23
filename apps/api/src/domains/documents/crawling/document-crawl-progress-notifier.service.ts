import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { PostgresStatusNotifierService } from "@/common/sse/postgres-status-notifier.service"
import { DOCUMENT_CRAWL_PROGRESS_CHANGED_CHANNEL } from "./document-crawl-progress.constants"

@Injectable()
export class DocumentCrawlProgressNotifierService extends PostgresStatusNotifierService {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, DOCUMENT_CRAWL_PROGRESS_CHANGED_CHANNEL)
  }

  async notifyCrawlProgress(params: {
    documentId: string
    organizationId: string
    projectId: string
    pagesCrawled: number
    updatedAt: number
  }): Promise<void> {
    await this.notify({
      type: DOCUMENT_CRAWL_PROGRESS_CHANGED_CHANNEL,
      documentId: params.documentId,
      organizationId: params.organizationId,
      projectId: params.projectId,
      pagesCrawled: params.pagesCrawled,
      updatedAt: params.updatedAt,
    })
  }
}
