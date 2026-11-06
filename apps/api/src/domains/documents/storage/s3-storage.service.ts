import { PassThrough, Readable } from "node:stream"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { v4 as uuidv4 } from "uuid"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"
import type { IFileStorage } from "./file-storage.interface"

const SIGNED_READ_URL_LIFETIME_SECONDS = 15 * 60

/** True for the 404 a missing key gets (HeadObject, and DeleteObject on GCS). */
export function isS3NotFound(error: unknown): boolean {
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
}

/** Client settings from the S3_* variables, for `endpoint` (the default AWS endpoint when unset). */
export function s3ClientConfig(
  configService: ConfigService,
  endpoint = configService.get<string>("S3_ENDPOINT") || undefined,
): S3ClientConfig {
  const accessKeyId = configService.get<string>("S3_ACCESS_KEY_ID")
  const secretAccessKey = configService.get<string>("S3_SECRET_ACCESS_KEY")
  return {
    endpoint,
    region: configService.get<string>("S3_REGION") || "us-east-1",
    forcePathStyle: configService.get<string>("S3_FORCE_PATH_STYLE") === "true",
    // Without credentials the SDK uses its default chain (environment, IAM role).
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    // The SDK adds CRC checksums by default. Several S3-compatible stores reject them,
    // and a checksum on a signed upload URL breaks the browser upload.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  }
}

/**
 * Any S3-compatible object storage (SeaweedFS, AWS S3, the GCS XML API with HMAC keys).
 *
 * The API reaches the storage at `S3_ENDPOINT`. Browsers use the signed URLs, so those are
 * signed for `S3_PUBLIC_ENDPOINT` when it is set: the host is part of the signature.
 */
@Injectable()
export class S3StorageService implements IFileStorage {
  private readonly logger = new Logger(S3StorageService.name)
  private readonly client: S3Client
  private readonly signingClient: S3Client
  private readonly bucketName: string

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>("S3_BUCKET") as string
    const endpoint = this.configService.get<string>("S3_ENDPOINT") || undefined
    const publicEndpoint = this.configService.get<string>("S3_PUBLIC_ENDPOINT") || endpoint
    this.client = new S3Client(s3ClientConfig(configService, endpoint))
    this.signingClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client(s3ClientConfig(configService, publicEndpoint))
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
    // A delete is idempotent: S3 answers 204 for a missing key, but the S3 API of GCS
    // answers 404 (NoSuchKey).
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: storageRelativePath }),
      )
    } catch (error) {
      if (!isS3NotFound(error)) throw error
    }
  }

  async readFile(storageRelativePath: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: storageRelativePath }),
    )
    if (!response.Body) {
      throw new InternalServerErrorException(`Empty body for ${storageRelativePath}`)
    }
    return Buffer.from(await response.Body.transformToByteArray())
  }

  createReadStream(storageRelativePath: string): Readable {
    // The interface is synchronous: the stream starts empty and receives the body once the
    // request answers. A failed request destroys the stream with the error.
    const stream = new PassThrough()
    this.client
      .send(new GetObjectCommand({ Bucket: this.bucketName, Key: storageRelativePath }))
      .then((response) => {
        if (!(response.Body instanceof Readable)) {
          throw new InternalServerErrorException(`No stream body for ${storageRelativePath}`)
        }
        response.Body.on("error", (error) => stream.destroy(error))
        response.Body.pipe(stream)
      })
      .catch((error: Error) => stream.destroy(error))
    return stream
  }

  async getTemporaryUrl(storageRelativePath: string): Promise<string> {
    // Signing is local (no network call), so unlike GCS keyless signing there is nothing to cache.
    return getSignedUrl(
      this.signingClient,
      new GetObjectCommand({ Bucket: this.bucketName, Key: storageRelativePath }),
      { expiresIn: SIGNED_READ_URL_LIFETIME_SECONDS },
    )
  }

  async generateSignedUploadUrl({
    storagePath,
    mimeType,
    expiresInSeconds,
    contentLength,
  }: {
    storagePath: string
    mimeType: string
    expiresInSeconds: number
    contentLength: number
  }): Promise<string> {
    return getSignedUrl(
      this.signingClient,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storagePath,
        ContentType: mimeType,
        ContentLength: contentLength,
      }),
      {
        expiresIn: expiresInSeconds,
        // Signed as headers, so the storage rejects a body of another type or size.
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    )
  }

  async fileExists(storageRelativePath: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: storageRelativePath }),
      )
      return true
    } catch (error) {
      if (isS3NotFound(error)) return false
      throw error
    }
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

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: storageRelativePath,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      )
      return { storageRelativePath, fileId }
    } catch (error) {
      this.logger.error(
        `Failed to upload file to S3: ${(error as Error).message}`,
        (error as Error).stack,
      )
      throw new InternalServerErrorException("Unable to save file to S3.")
    }
  }
}
