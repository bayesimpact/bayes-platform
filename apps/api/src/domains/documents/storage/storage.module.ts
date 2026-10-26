import { Logger, Module, type Provider } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { isEmpty } from "lodash"
import { FILE_STORAGE_SERVICE } from "./file-storage.interface"
import { GcsStorageService } from "./gcs-storage.service"
import { LocalStorageService } from "./local-storage.service"
import { S3StorageService } from "./s3-storage.service"

export type StorageBackend = "s3" | "gcs" | "local"

/** `STORAGE_BACKEND` when set, otherwise `gcs` when a GCS bucket is configured, otherwise `local`. */
export function resolveStorageBackend(configService: ConfigService): StorageBackend {
  const backend = configService.get<string>("STORAGE_BACKEND")
  if (backend === "s3" || backend === "gcs" || backend === "local") return backend
  if (!isEmpty(backend)) {
    throw new Error(`Invalid STORAGE_BACKEND: ${backend}. Use s3, gcs or local.`)
  }
  return isEmpty(configService.get<string>("GCS_STORAGE_BUCKET_NAME")) ? "local" : "gcs"
}

const storageProvider: Provider = {
  provide: FILE_STORAGE_SERVICE,
  useFactory: (configService: ConfigService) => {
    const backend = resolveStorageBackend(configService)
    Logger.log(`Use the ${backend} backend for file storage.`, "StorageModule")
    if (backend === "s3") {
      if (isEmpty(configService.get<string>("S3_BUCKET"))) {
        throw new Error("S3_BUCKET is required when STORAGE_BACKEND is s3.")
      }
      return new S3StorageService(configService)
    }
    if (backend === "gcs") return new GcsStorageService(configService)
    return new LocalStorageService(configService)
  },
  inject: [ConfigService],
}

@Module({
  imports: [ConfigModule],
  providers: [storageProvider],
  exports: [storageProvider],
})
export class StorageModule {}
