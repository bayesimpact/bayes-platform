import type { TestingModuleBuilder } from "@nestjs/testing"
import { setupUserGuardForTesting } from "../../../test/e2e.helpers"
import { URL_CRAWLING_BATCH_SERVICE } from "./crawling/url-crawling-batch.interface"
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
  getAuthSubject: () => string,
): TestingModuleBuilder {
  return setupUserGuardForTesting(
    withDocumentEmbeddingsBatchServiceMock(moduleBuilder),
    getAuthSubject,
  )
}

function createUrlCrawlingBatchServiceMock() {
  return {
    enqueueCrawlUrl: jest.fn().mockResolvedValue(undefined),
    cancelCrawlUrl: jest.fn().mockResolvedValue(undefined),
  }
}

export function withUrlCrawlingBatchServiceMock(
  moduleBuilder: TestingModuleBuilder,
): TestingModuleBuilder {
  return moduleBuilder
    .overrideProvider(URL_CRAWLING_BATCH_SERVICE)
    .useValue(createUrlCrawlingBatchServiceMock())
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
  getAuthSubject: () => string,
): TestingModuleBuilder {
  return setupUserGuardForTesting(
    withUrlCrawlingBatchServiceMock(
      withDocumentEmbeddingsBatchServiceMock(
        withDocumentEmbeddingStatusNotifierMock(moduleBuilder),
      ),
    ),
    getAuthSubject,
  )
}
