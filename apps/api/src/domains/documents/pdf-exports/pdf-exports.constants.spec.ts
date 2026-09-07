import { resolvePdfExportsSweepQueueName } from "./pdf-exports.constants"

describe("resolvePdfExportsSweepQueueName", () => {
  const originalValue = process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME
    } else {
      process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME = originalValue
    }
  })

  it("returns the configured queue name", () => {
    process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME = "custom-pdf-sweep"

    expect(resolvePdfExportsSweepQueueName()).toBe("custom-pdf-sweep")
  })

  it("throws when the variable is missing", () => {
    delete process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME

    expect(() => resolvePdfExportsSweepQueueName()).toThrow(
      "PDF_EXPORTS_SWEEP_QUEUE_NAME must be set",
    )
  })

  it("throws when the variable is empty", () => {
    process.env.PDF_EXPORTS_SWEEP_QUEUE_NAME = ""

    expect(() => resolvePdfExportsSweepQueueName()).toThrow(
      "PDF_EXPORTS_SWEEP_QUEUE_NAME must be set",
    )
  })
})
