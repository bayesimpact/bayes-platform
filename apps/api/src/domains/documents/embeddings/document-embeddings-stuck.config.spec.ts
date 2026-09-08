import {
  getDocumentEmbeddingStuckSweepIntervalSeconds,
  getDocumentEmbeddingStuckThresholdSeconds,
} from "./document-embeddings-stuck.config"

describe("document-embeddings-stuck.config", () => {
  const thresholdKey = "DOCUMENT_EMBEDDING_STUCK_THRESHOLD_SECONDS"
  const intervalKey = "DOCUMENT_EMBEDDING_STUCK_SWEEP_INTERVAL_SECONDS"
  const originalThreshold = process.env[thresholdKey]
  const originalInterval = process.env[intervalKey]

  afterAll(() => {
    if (originalThreshold === undefined) {
      delete process.env[thresholdKey]
    } else {
      process.env[thresholdKey] = originalThreshold
    }
    if (originalInterval === undefined) {
      delete process.env[intervalKey]
    } else {
      process.env[intervalKey] = originalInterval
    }
  })

  beforeEach(() => {
    process.env[thresholdKey] = "3600"
    process.env[intervalKey] = "60"
  })

  it("returns threshold seconds when set", () => {
    process.env[thresholdKey] = "86400"
    expect(getDocumentEmbeddingStuckThresholdSeconds()).toBe(86400)
  })

  it("throws when threshold env is missing", () => {
    delete process.env[thresholdKey]
    expect(() => getDocumentEmbeddingStuckThresholdSeconds()).toThrow(
      /DOCUMENT_EMBEDDING_STUCK_THRESHOLD_SECONDS must be set/,
    )
  })

  it("throws when threshold env is not a positive integer", () => {
    process.env[thresholdKey] = "0"
    expect(() => getDocumentEmbeddingStuckThresholdSeconds()).toThrow(
      /DOCUMENT_EMBEDDING_STUCK_THRESHOLD_SECONDS must be a positive integer/,
    )
  })

  it("throws when threshold env has a trailing unit", () => {
    process.env[thresholdKey] = "3600s"
    expect(() => getDocumentEmbeddingStuckThresholdSeconds()).toThrow(
      /DOCUMENT_EMBEDDING_STUCK_THRESHOLD_SECONDS must be a positive integer \(seconds\)/,
    )
  })

  it("returns sweep interval seconds when set", () => {
    process.env[intervalKey] = "900"
    expect(getDocumentEmbeddingStuckSweepIntervalSeconds()).toBe(900)
  })

  it("throws when sweep interval env is missing", () => {
    delete process.env[intervalKey]
    expect(() => getDocumentEmbeddingStuckSweepIntervalSeconds()).toThrow(
      /DOCUMENT_EMBEDDING_STUCK_SWEEP_INTERVAL_SECONDS must be set/,
    )
  })
})
