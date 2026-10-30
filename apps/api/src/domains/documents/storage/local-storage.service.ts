import { createReadStream } from "node:fs"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Readable } from "node:stream"
import { DOCUMENT_UPLOAD_MAX_BYTES } from "@caseai-connect/api-contracts"
import { Injectable, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { v4 as uuidv4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
import { PRIVATE_API_PATH } from "@/config/api-prefix"
import type { IFileStorage } from "./file-storage.interface"

/**
 * Largest body a local upload reads, whatever size was signed: the largest file any client
 * uploads, a document.
 */
export const LOCAL_UPLOAD_MAX_BYTES = DOCUMENT_UPLOAD_MAX_BYTES

@Injectable()
export class LocalStorageService implements IFileStorage {
  private readonly logger = new Logger(LocalStorageService.name)
  private readonly dir = path.join(process.cwd(), "dontsave_documents")
  private readonly baseUrl: string
  private readonly pendingUploads = new Map<
    string,
    { storagePath: string; expiresAt: number; contentLength: number }
  >()

  constructor(private readonly configService: ConfigService) {
    const envBaseUrl = process.env.LOCAL_STORAGE_SERVER_BASE_URL || "http://localhost:3000"
    this.baseUrl = this.configService.get<string>("SERVER_BASE_URL", envBaseUrl as string)
  }

  async generateSignedUploadUrl({
    storagePath,
    expiresInSeconds,
    contentLength,
  }: {
    storagePath: string
    mimeType: string
    expiresInSeconds: number
    contentLength: number
  }): Promise<string> {
    const token = uuidv4()
    this.pendingUploads.set(token, {
      storagePath,
      expiresAt: Date.now() + expiresInSeconds * 1000,
      contentLength,
    })
    return `${this.baseUrl}${PRIVATE_API_PATH}/local-presign-upload/${token}`
  }

  /**
   * Reads the body of a local upload and stops as soon as it passes the signed size or
   * `LOCAL_UPLOAD_MAX_BYTES`, so a caller never makes the API buffer more than that.
   */
  readUploadBody(token: string, body: Readable): Promise<Buffer> {
    const pending = this.pendingUploads.get(token)
    if (!pending) {
      return Promise.reject(new Error("Upload token not found or already used."))
    }
    const maxBytes = Math.min(pending.contentLength, LOCAL_UPLOAD_MAX_BYTES)
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      let receivedBytes = 0
      const onData = (chunk: Buffer) => {
        receivedBytes += chunk.length
        if (receivedBytes > maxBytes) {
          body.off("data", onData)
          body.pause()
          reject(
            maxBytes < pending.contentLength
              ? new UploadTooLargeError()
              : new UploadSizeMismatchError(),
          )
          return
        }
        chunks.push(chunk)
      }
      body.on("data", onData)
      body.on("end", () => resolve(Buffer.concat(chunks)))
      body.on("error", reject)
    })
  }

  async handleLocalUpload(token: string, fileBuffer: Buffer): Promise<void> {
    const pending = this.pendingUploads.get(token)
    if (!pending) {
      throw new Error("Upload token not found or already used.")
    }
    if (Date.now() > pending.expiresAt) {
      this.pendingUploads.delete(token)
      throw new Error("Upload token expired.")
    }
    if (fileBuffer.length !== pending.contentLength) {
      throw new UploadSizeMismatchError()
    }
    const destinationPath = path.join(this.dir, pending.storagePath)
    const destinationDir = path.dirname(destinationPath)
    await fs.mkdir(destinationDir, { recursive: true })
    await fs.writeFile(destinationPath, fileBuffer)
    this.pendingUploads.delete(token)
  }

  getTemporaryUrl(storageRelativePath: string): Promise<string> {
    return Promise.resolve(`${this.baseUrl}${PRIVATE_API_PATH}/documents/${storageRelativePath}`)
  }

  async readFile(storageRelativePath: string): Promise<Buffer> {
    return fs.readFile(path.join(this.dir, storageRelativePath))
  }

  async fileExists(storageRelativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.dir, storageRelativePath))
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
      throw error
    }
  }

  async deleteFile(storageRelativePath: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.dir, storageRelativePath))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
  }

  createReadStream(storageRelativePath: string): Readable {
    return createReadStream(path.join(this.dir, storageRelativePath))
  }

  async save({
    extension,
    file,
    connectScope,
  }: {
    extension: string
    file: MulterFile
    connectScope: RequiredConnectScope
  }): Promise<{ fileId: string; storageRelativePath: string }> {
    try {
      const destinationDir = path.join(
        this.dir,
        `${connectScope.organizationId}/${connectScope.projectId}`,
      )
      await fs.mkdir(destinationDir, { recursive: true })

      const fileId = uuidv4()
      const uniqueFileName = `${fileId}.${extension}`

      const destinationPath = path.join(destinationDir, uniqueFileName)

      await fs.writeFile(destinationPath, file.buffer)

      const storageRelativePath = this.buildStorageRelativePath({
        connectScope,
        documentId: fileId,
        extension,
      })

      this.logger.log(`File saved locally: ${storageRelativePath}`)

      return { storageRelativePath, fileId }
    } catch (error) {
      this.logger.error("Error saving file locally", error)
      throw new Error("Unable to save file locally.")
    }
  }

  buildStorageRelativePath({
    connectScope,
    documentId,
    extension,
  }: {
    connectScope: RequiredConnectScope
    documentId: string
    extension: string
  }): string {
    return `${connectScope.organizationId}/${connectScope.projectId}/${documentId}.${extension}`
  }
}

export class UploadSizeMismatchError extends Error {
  constructor() {
    super("Upload size does not match the signed size.")
    this.name = "UploadSizeMismatchError"
  }
}

export class UploadTooLargeError extends Error {
  constructor() {
    super(`Upload is larger than the local storage maximum of ${LOCAL_UPLOAD_MAX_BYTES} bytes.`)
    this.name = "UploadTooLargeError"
  }
}
