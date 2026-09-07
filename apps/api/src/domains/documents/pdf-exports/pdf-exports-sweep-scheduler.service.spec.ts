import { Logger } from "@nestjs/common"
import type { Queue } from "bullmq"
import { PDF_EXPORTS_SWEEP_JOB_NAME, PDF_EXPORTS_SWEEP_SCHEDULER_ID } from "./pdf-exports.constants"
import { PdfExportsSweepSchedulerService } from "./pdf-exports-sweep-scheduler.service"

describe("PdfExportsSweepSchedulerService", () => {
  const intervalKey = "PDF_EXPORT_SWEEP_INTERVAL_SECONDS"
  const originalInterval = process.env[intervalKey]

  beforeEach(() => {
    delete process.env[intervalKey]
    // Registration is logged by design; keep it out of the test output.
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    if (originalInterval === undefined) {
      delete process.env[intervalKey]
    } else {
      process.env[intervalKey] = originalInterval
    }
  })

  it("upserts the repeatable sweep job at the configured interval", async () => {
    process.env[intervalKey] = "120"
    const upsertJobScheduler = jest.fn().mockResolvedValue(undefined)
    const pdfExportsSweepQueue = { upsertJobScheduler } as unknown as Queue

    const scheduler = new PdfExportsSweepSchedulerService(pdfExportsSweepQueue)
    await scheduler.onModuleInit()

    expect(upsertJobScheduler).toHaveBeenCalledWith(
      PDF_EXPORTS_SWEEP_SCHEDULER_ID,
      { every: 120_000 },
      {
        name: PDF_EXPORTS_SWEEP_JOB_NAME,
        data: {},
      },
    )
  })

  it("falls back to the default interval", async () => {
    const upsertJobScheduler = jest.fn().mockResolvedValue(undefined)
    const pdfExportsSweepQueue = { upsertJobScheduler } as unknown as Queue

    await new PdfExportsSweepSchedulerService(pdfExportsSweepQueue).onModuleInit()

    expect(upsertJobScheduler).toHaveBeenCalledWith(
      PDF_EXPORTS_SWEEP_SCHEDULER_ID,
      { every: 300_000 },
      expect.anything(),
    )
  })
})
