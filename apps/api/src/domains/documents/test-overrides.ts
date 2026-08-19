import type { TestingModuleBuilder } from "@nestjs/testing"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import {
  DOCLING_CRAWLING_BATCH_SERVICE,
  type DoclingCrawlingBatchService,
} from "./crawling/docling-crawling-batch.interface"
import { DocumentEmbeddingStatusNotifierService } from "./embeddings/document-embedding-status-notifier.service"
import { DOCUMENT_EMBEDDINGS_BATCH_SERVICE } from "./embeddings/document-embeddings-batch.interface"

function createDocumentEmbeddingsBatchServiceMock() {
  return {
    enqueueCreateEmbeddingsForDocument: jest.fn().mockResolvedValue({
      embeddingStatus: "queued" as const,
      embeddingError: null,
      updatedAt: new Date(),
    }),
  }
}

export function withDocumentEmbeddingsBatchServiceMock(
  moduleBuilder: TestingModuleBuilder,
): TestingModuleBuilder {
  return moduleBuilder
    .overrideProvider(DOCUMENT_EMBEDDINGS_BATCH_SERVICE)
    .useValue(createDocumentEmbeddingsBatchServiceMock())
}

export function withDocumentAuthAndEmbeddingsMocks(
  moduleBuilder: TestingModuleBuilder,
  getAuth0Id: () => string,
): TestingModuleBuilder {
  return setupUserGuardForTesting(withDocumentEmbeddingsBatchServiceMock(moduleBuilder), getAuth0Id)
}

function createDoclingCrawlingBatchServiceMock(): jest.Mocked<DoclingCrawlingBatchService> {
  return {
    enqueueCrawlUrl: jest.fn().mockResolvedValue(undefined),
    cancelCrawlUrl: jest.fn().mockResolvedValue(undefined),
  }
}

export function withDoclingCrawlingBatchServiceMock(
  moduleBuilder: TestingModuleBuilder,
): TestingModuleBuilder {
  return moduleBuilder
    .overrideProvider(DOCLING_CRAWLING_BATCH_SERVICE)
    .useValue(createDoclingCrawlingBatchServiceMock())
}

export function withDocumentEmbeddingStatusNotifierMock(
  moduleBuilder: TestingModuleBuilder,
): TestingModuleBuilder {
  return moduleBuilder
    .overrideProvider(DocumentEmbeddingStatusNotifierService)
    .useValue({ notifyEmbeddingStatusChanged: jest.fn().mockResolvedValue(undefined) })
}

export function withCrawlingAndAuthMocks(
  moduleBuilder: TestingModuleBuilder,
  getAuth0Id: () => string,
): TestingModuleBuilder {
  return setupUserGuardForTesting(
    withDoclingCrawlingBatchServiceMock(
      withDocumentEmbeddingsBatchServiceMock(
        withDocumentEmbeddingStatusNotifierMock(moduleBuilder),
      ),
    ),
    getAuth0Id,
  )
}
