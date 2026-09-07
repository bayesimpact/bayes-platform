import { type Bucket, Storage } from "@google-cloud/storage"
import { BullModule } from "@nestjs/bullmq"
import { Module, type Provider } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { PDF_EXPORTS_BUCKET, PDF_EXPORTS_SWEEP_QUEUE_NAME } from "./pdf-exports.constants"
import { PdfExportsSweepService } from "./pdf-exports-sweep.service"
import { PdfExportsSweepWorker } from "./pdf-exports-sweep.worker"
import { PdfExportsSweepSchedulerService } from "./pdf-exports-sweep-scheduler.service"

/**
 * Same bucket and credentials as `GcsStorageService`: local setups without
 * `GCS_STORAGE_BUCKET_NAME` store files on disk, so there is nothing to sweep
 * and the provider yields null.
 */
const pdfExportsBucketProvider: Provider = {
  provide: PDF_EXPORTS_BUCKET,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Bucket | null => {
    const bucketName = configService.get<string>("GCS_STORAGE_BUCKET_NAME")
    if (!bucketName) {
      return null
    }
    const keyFilename =
      configService.get<string>("GCS_CREDENTIALS") ??
      configService.get<string>("GOOGLE_APPLICATION_CREDENTIALS")
    return new Storage(keyFilename ? { keyFilename } : {}).bucket(bucketName)
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
