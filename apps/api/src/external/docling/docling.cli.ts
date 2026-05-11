import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { unlink, writeFile } from "node:fs/promises"
import { platform, tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { EXTENSION_BY_MIME_TYPE } from "./docling.constants"

const DOCLING_NODES_BASH_RELATIVE_FROM_API = "bin/docling_nodes"
const DOCLING_NODES_BASH_RELATIVE_FROM_REPO_ROOT = "apps/api/bin/docling_nodes"
const DOCLING_NODES_PS1_RELATIVE_FROM_API = "bin/docling_nodes.ps1"
const DOCLING_NODES_PS1_RELATIVE_FROM_REPO_ROOT = "apps/api/bin/docling_nodes.ps1"
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

function buildDoclingNodesInvocation(extraArgs: readonly string[]): {
  executable: string
  args: string[]
} {
  const scriptPath = getDoclingNodesCommand()
  if (isPowerShellScript(scriptPath)) {
    return {
      executable: getPowerShellExecutable(),
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...extraArgs],
    }
  }
  return { executable: scriptPath, args: [...extraArgs] }
}

export type DoclingChunk = {
  embed_text: string
  // Keep other keys if the JSON schema changes; we only require embed_text.
  [key: string]: unknown
}

export function isDoclingEnabled(): boolean {
  const value = process.env.DOCUMENT_EXTRACTOR_DOCLING_ENABLED
  if (!value) {
    return true
  }
  return value.toLowerCase() === "true"
}

export function getDoclingNodesCommand(): string {
  const envOverride = process.env.DOCUMENT_EXTRACTOR_DOCLING_NODES_COMMAND
  if (envOverride) {
    return envOverride
  }

  // The API can run with cwd at repo root OR at apps/api.
  // Support both without requiring env configuration.
  const cwd = process.cwd()
  const bashCandidates: [string, string] = [
    join(cwd, DOCLING_NODES_BASH_RELATIVE_FROM_API),
    join(cwd, DOCLING_NODES_BASH_RELATIVE_FROM_REPO_ROOT),
  ]
  const ps1Candidates: [string, string] = [
    join(cwd, DOCLING_NODES_PS1_RELATIVE_FROM_API),
    join(cwd, DOCLING_NODES_PS1_RELATIVE_FROM_REPO_ROOT),
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
}): Promise<DoclingChunk[]> {
  const extension = EXTENSION_BY_MIME_TYPE[mimeType]
  if (!extension) {
    throw new Error(`Docling does not support MIME type mapping: ${mimeType}`)
  }

  const inputPath = join(tmpdir(), `docling-${randomUUID()}.${extension}`)
  await writeFile(inputPath, buffer)

  try {
    const invocation = buildDoclingNodesInvocation([
      "--doc-path",
      inputPath,
      "--output-stdout",
      "--no-all-content",
    ])
    const { stdout } = await runCommand(invocation.executable, invocation.args, {
      timeout: timeoutMs ?? getDoclingTimeoutMs(),
      maxBuffer,
    })

    const stdoutTrimmed = stdout.trim()
    if (!stdoutTrimmed) {
      throw new Error(`Docling nodes produced empty stdout for MIME type: ${mimeType}`)
    }

    const parsed: unknown = JSON.parse(stdoutTrimmed)
    if (!Array.isArray(parsed)) {
      throw new Error(
        `Docling nodes returned non-array JSON for MIME type ${mimeType}: ${stdoutTrimmed.slice(0, 200)}`,
      )
    }

    const chunks = parsed.map((item: unknown, index: number) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Docling node at index ${index} is not an object`)
      }
      const maybeRecord = item as Record<string, unknown>
      const embedText = maybeRecord.embed_text
      if (typeof embedText !== "string") {
        throw new Error(`Docling node at index ${index} missing embed_text string`)
      }
      return maybeRecord as DoclingChunk
    })

    return chunks
  } finally {
    await unlink(inputPath).catch(() => undefined)
  }
}

export async function getDoclingVersion({
  timeoutMs,
  maxBuffer = 1024 * 1024,
}: {
  timeoutMs?: number
  maxBuffer?: number
} = {}): Promise<string> {
  const invocation = buildDoclingNodesInvocation(["--docling-version"])
  const { stdout } = await runCommand(invocation.executable, invocation.args, {
    timeout: timeoutMs ?? getDoclingTimeoutMs(),
    maxBuffer,
  })
  return stdout.trim()
}
