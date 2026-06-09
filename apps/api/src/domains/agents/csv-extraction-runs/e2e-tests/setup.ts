import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import type { TestingModuleBuilder } from "@nestjs/testing"
import { FILE_STORAGE_SERVICE } from "@/domains/documents/storage/file-storage.interface"
import { setupUserGuardForTesting } from "../../../../../test/e2e.helpers"
import { AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE } from "../agent-csv-extraction-run-batch.interface"

/** A batch service whose queue interactions are stubbed out (no Redis/BullMQ). */
export const buildMockBatchService = () => ({
  enqueueExecuteRun: jest.fn().mockResolvedValue(undefined),
  enqueueRunRecords: jest.fn().mockResolvedValue(undefined),
  retryRunRecords: jest.fn().mockResolvedValue(undefined),
  removePendingRunRecords: jest.fn().mockResolvedValue(undefined),
})

/** A file storage whose I/O is stubbed; `createReadStream` yields a small CSV. */
export const buildMockFileStorageService = () => ({
  save: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ fileId: randomUUID(), storageRelativePath: "documents/export.csv" }),
    ),
  getTemporaryUrl: jest.fn().mockResolvedValue("https://example.com/file.csv"),
  readFile: jest.fn().mockResolvedValue(Buffer.from("")),
  createReadStream: jest.fn(() => Readable.from(["name,age\nAlice,30\nBob,40\n"])),
  generateSignedUploadUrl: jest.fn().mockResolvedValue("https://example.com/upload"),
  buildStorageRelativePath: jest.fn(() => "documents/input.csv"),
})

/**
 * Shared module overrides for the CSV-extraction-run e2e specs: stubbed JWT,
 * batch service and file storage so the controller can be exercised over HTTP
 * without external infrastructure.
 */
export const applyCsvExtractionRunOverrides = (
  moduleBuilder: TestingModuleBuilder,
  getAuth0Id: () => string,
  mocks: {
    batchService: ReturnType<typeof buildMockBatchService>
    fileStorageService: ReturnType<typeof buildMockFileStorageService>
  },
): TestingModuleBuilder =>
  setupUserGuardForTesting(moduleBuilder, getAuth0Id)
    .overrideProvider(AGENT_CSV_EXTRACTION_RUN_BATCH_SERVICE)
    .useValue(mocks.batchService)
    .overrideProvider(FILE_STORAGE_SERVICE)
    .useValue(mocks.fileStorageService)
