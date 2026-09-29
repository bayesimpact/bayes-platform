import type { Readable } from "node:stream"
import {
  DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER,
  documentUploadContentLengthRange,
} from "@caseai-connect/api-contracts"
import { Storage } from "@google-cloud/storage"
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { v4 as uuidv4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
import type { IFileStorage } from "./file-storage.interface"

// Signed read URL cache configuration
const SIGNED_READ_URL_LIFETIME_MS = 15 * 60 * 1000 // 15 minutes
// Shorter than the URL lifetime so a cache hit always has at least 5 minutes of validity left.
const SIGNED_READ_URL_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const SIGNED_READ_URL_CACHE_MAX_ENTRIES = 5000 // Maximum number of cached signed read URLs

@Injectable()
export class GcsStorageService implements IFileStorage {
  private readonly logger = new Logger(GcsStorageService.name)
  private readonly storage: Storage
  private readonly bucketName: string
  private readonly signedReadUrlCache = new Map<string, { url: string; expiresAtMs: number }>()

  constructor(private readonly configService: ConfigService) {
    this.storage = new Storage({
      keyFilename:
        this.configService.get<string>("GCS_CREDENTIALS") ??
        this.configService.get<string>("GOOGLE_APPLICATION_CREDENTIALS"),
    })
    this.bucketName = this.configService.get<string>("GCS_STORAGE_BUCKET_NAME") as string
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

  async deleteFile(storageRelativePath: string): Promise<void> {
    this.signedReadUrlCache.delete(storageRelativePath)
    await this.storage
      .bucket(this.bucketName)
      .file(storageRelativePath)
      .delete({ ignoreNotFound: true })
  }

  async readFile(storageRelativePath: string): Promise<Buffer> {
    const [contents] = await this.storage
      .bucket(this.bucketName)
      .file(storageRelativePath)
      .download()
    return contents
  }

  createReadStream(storageRelativePath: string): Readable {
    return this.storage.bucket(this.bucketName).file(storageRelativePath).createReadStream()
  }

  async getTemporaryUrl(storageRelativePath: string): Promise<string> {
    // With keyless (IAM-based) signing, every getSignedUrl is a signBlob HTTP call, and page-image
    // consumers request the same objects on every turn — so cache signed read URLs per object path.
    const cached = this.signedReadUrlCache.get(storageRelativePath)
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.url
    }

    const bucket = this.storage.bucket(this.bucketName)
    const file = bucket.file(storageRelativePath)
    // V4: same keyless IAM signing path as the upload URLs; V2 is legacy.
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + SIGNED_READ_URL_LIFETIME_MS,
    })
    this.cacheSignedReadUrl(storageRelativePath, url)
    return url
  }

  private cacheSignedReadUrl(storageRelativePath: string, url: string): void {
    if (this.signedReadUrlCache.size >= SIGNED_READ_URL_CACHE_MAX_ENTRIES) {
      const now = Date.now()
      for (const [cachedPath, entry] of this.signedReadUrlCache) {
        if (entry.expiresAtMs <= now) {
          this.signedReadUrlCache.delete(cachedPath)
        }
      }
      // Still full after dropping expired entries: evict oldest-inserted first.
      while (this.signedReadUrlCache.size >= SIGNED_READ_URL_CACHE_MAX_ENTRIES) {
        const oldestPath = this.signedReadUrlCache.keys().next().value
        if (oldestPath === undefined) break
        this.signedReadUrlCache.delete(oldestPath)
      }
    }
    this.signedReadUrlCache.set(storageRelativePath, {
      url,
      expiresAtMs: Date.now() + SIGNED_READ_URL_CACHE_TTL_MS,
    })
  }

  async generateSignedUploadUrl({
    storagePath,
    mimeType,
    expiresInSeconds,
    maxBytes,
  }: {
    storagePath: string
    mimeType: string
    expiresInSeconds: number
    maxBytes?: number
  }): Promise<string> {
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(storagePath)
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + expiresInSeconds * 1000,
        contentType: mimeType,
        ...(maxBytes !== undefined
          ? {
              extensionHeaders: {
                [DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER]:
                  documentUploadContentLengthRange(maxBytes),
              },
            }
          : {}),
      })
    return url
  }

  async fileExists(storageRelativePath: string): Promise<boolean> {
    const [exists] = await this.storage.bucket(this.bucketName).file(storageRelativePath).exists()
    return exists
  }

  async save({
    connectScope,
    file,
    extension,
  }: {
    connectScope: RequiredConnectScope
    extension: string
    file: MulterFile
  }): Promise<{ storageRelativePath: string; fileId: string }> {
    if (!file) {
      throw new InternalServerErrorException("No file received.")
    }

    const fileId = uuidv4()
    const storageRelativePath = this.buildStorageRelativePath({
      connectScope,
      documentId: fileId,
      extension,
    })

    const bucket = this.storage.bucket(this.bucketName)
    const fileRef = bucket.file(storageRelativePath)

    // For creation, ensure the object does not already exist.
    // The precondition is that its "generation" must be 0.
    const generationMatchPrecondition = 0

    try {
      await fileRef.save(file.buffer, {
        resumable: true,
        contentType: file.mimetype,
        // cacheControl: 'public, max-age=31536000', // 1 year
        preconditionOpts: { ifGenerationMatch: generationMatchPrecondition },
      })

      return {
        storageRelativePath: storageRelativePath,
        fileId: fileId,
      }
      // biome-ignore lint/suspicious/noExplicitAny: error handling
    } catch (error: any) {
      this.logger.error(`Failed to upload file to GCS: ${error.message}`, error.stack)
      throw new InternalServerErrorException("Unable to save file to GCS.")
    }
  }
}
