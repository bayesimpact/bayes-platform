import { DocumentChunkerError, summarizeChunkerFailure } from "./docling.cli"

describe("summarizeChunkerFailure", () => {
  const commandLine = "Command failed: /app/apps/api/bin/document_chunker --doc-path /tmp/doc.pdf"

  it("returns the last Python exception of stderr", () => {
    const stderr = [
      "Warning: could not classify PDF text layer for doc.pdf; using the default docling pipeline.",
      "\rLoading weights:   0%|          | 0/770\rLoading weights: 100%|##########| 770/770",
      "Traceback (most recent call last):",
      '  File "rapidocr/utils/download_file.py", line 90, in _save_response_with_progress',
      "PermissionError: [Errno 13] Permission denied: '/opt/models/det.pth'",
      "Error while parsing document.",
      "Details: Conversion failed for: doc.pdf with status: failure.",
    ].join("\n")
    expect(summarizeChunkerFailure({ message: commandLine, stderr }, 60_000)).toBe(
      "PermissionError: [Errno 13] Permission denied: '/opt/models/det.pth'",
    )
  })

  it("returns the last line of stderr without a Python exception", () => {
    expect(
      summarizeChunkerFailure(
        { message: commandLine, stderr: "Loading\nNo module named docling\n" },
        1,
      ),
    ).toBe("No module named docling")
  })

  it("returns the first line of the message without stderr", () => {
    expect(summarizeChunkerFailure({ message: `${commandLine}\nmore` }, 1)).toBe(commandLine)
  })

  it("names a timeout", () => {
    expect(
      summarizeChunkerFailure({ message: commandLine, stderr: "", killed: true }, 60_000),
    ).toBe("timed out after 60000 ms")
  })
})

describe("DocumentChunkerError", () => {
  it("keeps one line in the message and stderr in the stack", () => {
    const error = new DocumentChunkerError(
      "PermissionError: denied",
      "Traceback\nPermissionError: denied",
    )
    expect(error.message).toBe("Document chunker failed: PermissionError: denied")
    expect(error.stack).toContain("stderr:\nTraceback\nPermissionError: denied")
  })
})
