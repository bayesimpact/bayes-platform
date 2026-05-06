import { execFile } from "node:child_process"
import { access } from "node:fs/promises"
import { promisify } from "node:util"
import { Logger } from "@nestjs/common"
import { getDoclingTimeoutMs, getDocumentChunkerCommand, isDoclingEnabled } from "./docling.cli"

const DEFAULT_WORKER_DOCLING_SELF_TEST_FILE = "/app/apps/api/bin/sample.pdf"
const DOCLING_SELF_TEST_MAX_BUFFER_BYTES = 20 * 1024 * 1024

const runCommand = promisify(execFile)

function isWorkerDoclingSelfTestEnabled(): boolean {
  const value = process.env.WORKER_DOCLING_SELF_TEST_ENABLED
  if (!value) {
    return false
  }
  return value.toLowerCase() === "true"
}

function getWorkerDoclingSelfTestFile(): string {
  return process.env.WORKER_DOCLING_SELF_TEST_FILE ?? DEFAULT_WORKER_DOCLING_SELF_TEST_FILE
}

export async function runDoclingSelfTestIfEnabled(timeoutMs: number): Promise<void> {
  if (!isWorkerDoclingSelfTestEnabled()) {
    return
  }

  if (!isDoclingEnabled()) {
    Logger.log(
      "Docling self-test skipped because DOCUMENT_EXTRACTOR_DOCLING_ENABLED=false",
      "WorkersMain",
    )
    return
  }

  const selfTestFile = getWorkerDoclingSelfTestFile()
  try {
    await access(selfTestFile)
  } catch {
    throw new Error(
      `Docling self-test file not found: ${selfTestFile}. Set WORKER_DOCLING_SELF_TEST_FILE to an existing file.`,
    )
  }

  Logger.log(
    `Running Docling self-test on file: ${selfTestFile} (command: ${getDocumentChunkerCommand()})`,
    "WorkersMain",
  )

  const { stdout, stderr } = await runCommand(
    getDocumentChunkerCommand(),
    ["--doc-path", selfTestFile, "--output-stdout", "--max-nodes", "1"],
    {
      timeout: getDoclingTimeoutMs(timeoutMs),
      maxBuffer: DOCLING_SELF_TEST_MAX_BUFFER_BYTES,
    },
  )

  if (stdout.trim()) {
    Logger.log(`Docling self-test stdout:\n${stdout.trim()}`, "WorkersMain")
  }
  if (stderr.trim()) {
    Logger.log(`Docling self-test stderr:\n${stderr.trim()}`, "WorkersMain")
  }
}
