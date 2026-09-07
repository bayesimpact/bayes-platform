import { Logger } from "@nestjs/common"
import type { Job } from "bullmq"
import type { PdfExportsSweepService } from "./pdf-exports-sweep.service"
import { PdfExportsSweepWorker } from "./pdf-exports-sweep.worker"

describe("PdfExportsSweepWorker", () => {
  beforeEach(() => {
    // The worker reports its counts by design; keep them out of the test output.
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("runs the sweep", async () => {
    const sweepExpiredExports = jest
      .fn()
      .mockResolvedValue({ scanned: 3, deleted: 2, failed: 0, skipped: false })
    const pdfExportsSweepService = {
      sweepExpiredExports,
    } as unknown as PdfExportsSweepService

    const worker = new PdfExportsSweepWorker(pdfExportsSweepService)
    const job = { id: "job-1" } as unknown as Job

    await worker.process(job)

    expect(sweepExpiredExports).toHaveBeenCalledTimes(1)
  })
})
