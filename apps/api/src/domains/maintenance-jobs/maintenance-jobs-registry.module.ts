import { Module } from "@nestjs/common"
import { LegacyWebCrawlMigrationJob } from "./legacy-web-crawl/legacy-web-crawl-migration.job"
import { LegacyWebCrawlMigrationModule } from "./legacy-web-crawl/legacy-web-crawl-migration.module"
import type { MaintenanceJob } from "./maintenance-job.interface"
import { MAINTENANCE_JOBS } from "./maintenance-jobs.constants"

/**
 * The maintenance jobs of the platform. Add a job here with its module, and remove both once the
 * job has nothing left to do on every platform.
 */
@Module({
  imports: [LegacyWebCrawlMigrationModule],
  providers: [
    {
      provide: MAINTENANCE_JOBS,
      inject: [LegacyWebCrawlMigrationJob],
      useFactory: (...jobs: MaintenanceJob[]): MaintenanceJob[] => jobs,
    },
  ],
  exports: [MAINTENANCE_JOBS],
})
export class MaintenanceJobsRegistryModule {}
