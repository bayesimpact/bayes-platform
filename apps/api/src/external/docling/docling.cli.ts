import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, unlink, writeFile } from "node:fs/promises"
import { platform, tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { EXTENSION_BY_MIME_TYPE } from "./docling.constants"
import type { DoclingOutput } from "./docling.types"

const DOCUMENT_CHUNKER_BASH_RELATIVE_FROM_API = "bin/document_chunker"
const DOCUMENT_CHUNKER_BASH_RELATIVE_FROM_REPO_ROOT = "apps/api/bin/document_chunker"
// PS1 fallback points at the legacy docling_nodes.ps1 (which invokes docling_nodes_cuda.py).
// That script still emits the pre-chunking-v2 JSON schema, so Windows extraction will need
// a follow-up to either port CUDA detection into document_chunker.py or add a document_chunker.ps1.
const DOCUMENT_CHUNKER_PS1_RELATIVE_FROM_API = "bin/docling_nodes.ps1"
const DOCUMENT_CHUNKER_PS1_RELATIVE_FROM_REPO_ROOT = "apps/api/bin/docling_nodes.ps1"
const DEFAULT_DOCLING_TIMEOUT_MS = 60_000

const IS_WINDOWS = platform() === "win32"

const runCommand = promisify(execFile)

function isPowerShellScript(scriptPath: string): boolean {
  return scriptPath.toLowerCase().endsWith(".ps1")
}

function getPowerShellExecutable(): string {
  return (
    process.env.DOCUMENT_EXTRACTOR_DOCLING_POWERSHELL ?? (IS_WINDOWS ? "powershell.exe" : "pwsh")
  )
}

function buildDocumentChunkerInvocation(extraArgs: readonly string[]): {
  executable: string
  args: string[]
} {
  const scriptPath = getDocumentChunkerCommand()
  if (isPowerShellScript(scriptPath)) {
    return {
      executable: getPowerShellExecutable(),
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...extraArgs],
    }
  }
  return { executable: scriptPath, args: [...extraArgs] }
}

export function isDoclingEnabled(): boolean {
  const value = process.env.DOCUMENT_EXTRACTOR_DOCLING_ENABLED
  if (!value) {
    return true
  }
  return value.toLowerCase() === "true"
}

export function getDocumentChunkerCommand(): string {
  const envOverride = process.env.DOCUMENT_CHUNKER_COMMAND
  if (envOverride) {
    return envOverride
  }

  // The API can run with cwd at repo root OR at apps/api.
  // Support both without requiring env configuration.
  const cwd = process.cwd()
  const bashCandidates: [string, string] = [
    join(cwd, DOCUMENT_CHUNKER_BASH_RELATIVE_FROM_API),
    join(cwd, DOCUMENT_CHUNKER_BASH_RELATIVE_FROM_REPO_ROOT),
  ]
  const ps1Candidates: [string, string] = [
    join(cwd, DOCUMENT_CHUNKER_PS1_RELATIVE_FROM_API),
    join(cwd, DOCUMENT_CHUNKER_PS1_RELATIVE_FROM_REPO_ROOT),
  ]

  const candidates = IS_WINDOWS
    ? [...ps1Candidates, ...bashCandidates]
    : [...bashCandidates, ...ps1Candidates]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  // Fall back to the repo-root shape for a clearer error message.
  return IS_WINDOWS ? ps1Candidates[1] : bashCandidates[1]
}

export function getDoclingTimeoutMs(defaultTimeoutMs = DEFAULT_DOCLING_TIMEOUT_MS): number {
  const value = process.env.DOCUMENT_EXTRACTOR_DOCLING_TIMEOUT_MS
  if (!value) {
    return defaultTimeoutMs
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? defaultTimeoutMs : parsed
}

export async function extractTextWithDocling({
  buffer,
  mimeType,
  timeoutMs,
  maxBuffer,
}: {
  buffer: Buffer
  mimeType: string
  timeoutMs?: number
  maxBuffer: number
}): Promise<DoclingOutput> {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType]
  if (!extension) {
    throw new Error(`Docling does not support MIME type mapping: ${mimeType}`)
  }

  const inputPath = join(tmpdir(), `docling-${randomUUID()}.${extension}`)
  const outputPath = join(tmpdir(), `docling-out-${randomUUID()}.json`)
  await writeFile(inputPath, buffer)

  try {
    const invocation = buildDocumentChunkerInvocation([
      "--doc-path",
      inputPath,
      "--output-json",
      outputPath,
    ])
    await runCommand(invocation.executable, invocation.args, {
      timeout: timeoutMs ?? getDoclingTimeoutMs(),
      maxBuffer,
    })

    const raw = await readFile(outputPath, "utf8")
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        `Document chunker returned unexpected JSON shape for MIME type ${mimeType}: ${raw.slice(0, 200)}`,
      )
    }

    const record = parsed as Record<string, unknown>
    if (!Array.isArray(record.child_chunks) || !Array.isArray(record.parent_chunks)) {
      throw new Error(
        `Document chunker output missing child_chunks or parent_chunks for MIME type ${mimeType}`,
      )
    }

    return parsed as DoclingOutput
  } finally {
    await unlink(inputPath).catch(() => undefined)
    await unlink(outputPath).catch(() => undefined)
  }
}

export async function getDoclingVersion({
  timeoutMs,
  maxBuffer = 1024 * 1024,
}: {
  timeoutMs?: number
  maxBuffer?: number
} = {}): Promise<string> {
  const invocation = buildDocumentChunkerInvocation(["--docling-version"])
  const { stdout } = await runCommand(invocation.executable, invocation.args, {
    timeout: timeoutMs ?? getDoclingTimeoutMs(),
    maxBuffer,
  })
  return stdout.trim()
}
