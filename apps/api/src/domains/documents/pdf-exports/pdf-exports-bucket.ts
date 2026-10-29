import { DeleteObjectCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3"
import { isS3NotFound } from "../storage/s3-storage.service"

export type PdfExportsObject = {
  name: string
  /** `undefined` when the storage does not report it. */
  createdAt?: Date
}

/** The two bucket operations the sweep needs. */
export interface PdfExportsBucket {
  listPage(query: { prefix: string; pageSize: number; pageToken?: string }): Promise<{
    objects: PdfExportsObject[]
    /** `undefined` on the last page. */
    nextPageToken?: string
  }>
  /** Succeeds when the object is already gone. */
  delete(name: string): Promise<void>
}

export class S3PdfExportsBucket implements PdfExportsBucket {
  constructor(
    private readonly client: S3Client,
    private readonly bucketName: string,
  ) {}

  async listPage({
    prefix,
    pageSize,
    pageToken,
  }: {
    prefix: string
    pageSize: number
    pageToken?: string
  }) {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: pageSize,
        ContinuationToken: pageToken,
      }),
    )
    return {
      objects: (response.Contents ?? []).flatMap((object) =>
        object.Key ? [{ name: object.Key, createdAt: object.LastModified }] : [],
      ),
      nextPageToken: response.IsTruncated ? response.NextContinuationToken : undefined,
    }
  }

  async delete(name: string): Promise<void> {
    // The S3 API of GCS answers 404 for a missing key, where S3 answers 204.
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: name }))
    } catch (error) {
      if (!isS3NotFound(error)) throw error
    }
  }
}
