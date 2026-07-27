import type { Readable } from "node:stream"
import { Storage } from "@google-cloud/storage"
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { v4 as uuidv4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
import type { IFileStorage } from "./file-storage.interface"

@Injectable()
export class GcsStorageService implements IFileStorage {
  private readonly logger = new Logger(GcsStorageService.name)
  private readonly storage: Storage
  private readonly bucketName: string

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
    // Construct the temporary URL for the file in GCS
    // Generate a signed URL for temporary access (default: 15 minutes)
    const bucket = this.storage.bucket(this.bucketName)
    const file = bucket.file(storageRelativePath)
    const expires = Date.now() + 15 * 60 * 1000 // 15 minutes
    const [url] = await file.getSignedUrl({
      action: "read",
      expires,
    })
    return url
  }

  async generateSignedUploadUrl({
    storagePath,
    mimeType,
    expiresInSeconds,
  }: {
    storagePath: string
    mimeType: string
    expiresInSeconds: number
  }): Promise<string> {
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(storagePath)
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + expiresInSeconds * 1000,
        contentType: mimeType,
      })
    return url
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
