import { S3Client } from "@aws-sdk/client-s3"
import { BullModule } from "@nestjs/bullmq"
import { Module, type Provider } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { s3ClientConfig } from "../storage/s3-storage.service"
import { resolveStorageBackend } from "../storage/storage.module"
import { PDF_EXPORTS_BUCKET, PDF_EXPORTS_SWEEP_QUEUE_NAME } from "./pdf-exports.constants"
import { type PdfExportsBucket, S3PdfExportsBucket } from "./pdf-exports-bucket"
import { PdfExportsSweepService } from "./pdf-exports-sweep.service"
import { PdfExportsSweepWorker } from "./pdf-exports-sweep.worker"
import { PdfExportsSweepSchedulerService } from "./pdf-exports-sweep-scheduler.service"

/**
 * Same bucket and credentials as the file storage service: local setups store
 * files on disk, so there is nothing to sweep and the provider yields null.
 */
const pdfExportsBucketProvider: Provider = {
  provide: PDF_EXPORTS_BUCKET,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): PdfExportsBucket | null => {
    const backend = resolveStorageBackend(configService)
    if (backend === "s3") {
      return new S3PdfExportsBucket(
        new S3Client(s3ClientConfig(configService)),
        configService.get<string>("S3_BUCKET") as string,
      )
    }
    return null
  },
}

@Module({
  imports: [
    BullModule.registerQueue({
      name: PDF_EXPORTS_SWEEP_QUEUE_NAME,
    }),
    ConfigModule,
  ],
  providers: [
    PdfExportsSweepWorker,
    PdfExportsSweepService,
    PdfExportsSweepSchedulerService,
    pdfExportsBucketProvider,
  ],
})
export class PdfExportsSweepWorkersModule {}
