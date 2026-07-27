import type { Readable } from "node:stream"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { MulterFile } from "@/common/types"

export interface IFileStorage {
  save(p: { extension: string; file: MulterFile; connectScope: RequiredConnectScope }): Promise<{
    fileId: string
    storageRelativePath: string
  }>
  getTemporaryUrl(storageRelativePath: string): Promise<string>
  deleteFile(storageRelativePath: string): Promise<void>
  readFile(storageRelativePath: string): Promise<Buffer>
  createReadStream(storageRelativePath: string): Readable
  generateSignedUploadUrl(p: {
    storagePath: string
    mimeType: string
    expiresInSeconds: number
  }): Promise<string>
  buildStorageRelativePath(p: {
    connectScope: RequiredConnectScope
    documentId: string
    extension: string
  }): string
}

// We use an "Injection Token" for dependency injection
export const FILE_STORAGE_SERVICE = "FileStorageService"
