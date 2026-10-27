import { LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE } from "@caseai-connect/api-contracts"
import { Injectable, Logger } from "@nestjs/common"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentSourcesService } from "@/domains/documents/sources/document-sources.service"
import type {
  MaintenanceJob,
  MaintenanceJobPreview,
  MaintenanceJobResult,
  MaintenanceJobRunContext,
} from "../maintenance-job.interface"
import {
  type LegacyWebCrawlPage,
  legacyWebCrawlExternalId,
  parseLegacyWebCrawlPages,
  titleForLegacyWebCrawlPage,
} from "./legacy-web-crawl.helpers"
import type { LegacyWebCrawlDocument } from "./legacy-web-crawl-document.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { LegacyWebCrawlDocumentRepository } from "./legacy-web-crawl-document.repository"

/**
 * Turns each legacy web crawl (one document holding every page of a site as JSON) into a document
 * source of type `legacy-web-crawl` with one document per page, embedded like the pages the site
 * crawler app sends. Then it removes the legacy document: its citations in conversations, its
 * chunks and the document itself.
 *
 * Idempotent: the source is found again by its external id, and a source left half-filled by an
 * interrupted run is emptied and filled again. The legacy document goes last, so a document still
 * there has not been migrated.
 */
@Injectable()
export class LegacyWebCrawlMigrationJob implements MaintenanceJob {
  readonly key = "legacy-web-crawl-to-document-sources"
  readonly title = "Legacy web crawls to document sources"
  readonly description =
    "Turns each site crawled by the former web crawler into a document source with one document per page, embeds the pages again, then removes the former document and its citations in conversations."

  private readonly logger = new Logger(LegacyWebCrawlMigrationJob.name)

  constructor(
    private readonly legacyWebCrawlDocumentRepository: LegacyWebCrawlDocumentRepository,
    private readonly documentSourcesService: DocumentSourcesService,
    private readonly documentsService: DocumentsService,
  ) {}

  async preview(): Promise<MaintenanceJobPreview> {
    const { documentCount, projectCount } =
      await this.legacyWebCrawlDocumentRepository.countRemaining()
    return {
      remainingCount: documentCount,
      remainingSummary: `${documentCount} web crawl(s) in ${projectCount} project(s)`,
    }
  }

  async run({
    requestedByUserId,
    reportProgress,
  }: MaintenanceJobRunContext): Promise<MaintenanceJobResult> {
    const documentRefs = await this.legacyWebCrawlDocumentRepository.listRemaining()
    let migratedCount = 0
    let pageCount = 0
    const failures: string[] = []

    await reportProgress({ done: 0, total: documentRefs.length })
    for (const [index, documentRef] of documentRefs.entries()) {
      try {
        const document = await this.legacyWebCrawlDocumentRepository.findRemaining(documentRef.id)
        if (document) {
          pageCount += await this.migrateDocument({ document, requestedByUserId })
          migratedCount++
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.error(`Legacy web crawl ${documentRef.id} not migrated: ${message}`)
        failures.push(`${documentRef.id} (${message})`)
      }
      await reportProgress({ done: index + 1, total: documentRefs.length })
    }

    const summary = `${migratedCount} web crawl(s) migrated into ${pageCount} page document(s).`
    return {
      summary:
        failures.length === 0
          ? summary
          : `${summary} ${failures.length} failed: ${failures.join(", ")}.`,
    }
  }

  /** Returns how many page documents the source now holds. */
  private async migrateDocument({
    document,
    requestedByUserId,
  }: {
    document: LegacyWebCrawlDocument
    requestedByUserId: string
  }): Promise<number> {
    const connectScope: RequiredConnectScope = {
      organizationId: document.organizationId,
      projectId: document.projectId,
    }
    const pages = parseLegacyWebCrawlPages(document.content)
    // A crawl that never ended has no page: there is nothing to keep, only the document to remove.
    if (pages.length > 0) {
      const sourceId = await this.findOrCreateSource({ connectScope, document })
      for (const page of pages) {
        await this.createPageDocument({ connectScope, sourceId, page, requestedByUserId })
      }
    }

    await this.legacyWebCrawlDocumentRepository.removeFromMessageSources({
      projectId: document.projectId,
      documentId: document.id,
    })
    await this.legacyWebCrawlDocumentRepository.deleteChunks(document.id)
    await this.documentsService.deleteDocument({ connectScope, documentId: document.id })
    return pages.length
  }

  private async findOrCreateSource({
    connectScope,
    document,
  }: {
    connectScope: RequiredConnectScope
    document: LegacyWebCrawlDocument
  }): Promise<string> {
    const externalId = legacyWebCrawlExternalId(document.id)
    const [existingSource] = await this.documentSourcesService.getAll(connectScope, { externalId })
    if (existingSource) {
      // A previous run stopped while filling this source: start its pages over.
      await this.documentsService.deleteDocumentsForSource(connectScope, existingSource.id)
      return existingSource.id
    }
    const source = await this.documentSourcesService.createOne(connectScope, {
      name: document.title,
      type: LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE,
      externalId,
      baseUrl: document.sourceUrl,
      config: null,
    })
    return source.id
  }

  private async createPageDocument({
    connectScope,
    sourceId,
    page,
    requestedByUserId,
  }: {
    connectScope: RequiredConnectScope
    sourceId: string
    page: LegacyWebCrawlPage
    requestedByUserId: string
  }): Promise<void> {
    await this.documentsService.createInlineProjectDocument({
      connectScope,
      userId: requestedByUserId,
      title: titleForLegacyWebCrawlPage(page),
      content: page.markdown,
      sourceUrl: page.url,
      documentSourceId: sourceId,
      sourceType: "app",
    })
  }
}
