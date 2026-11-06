import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { MAINTENANCE_JOBS_QUEUE_NAME } from "./maintenance-jobs.constants"
import { MaintenanceJobsWorker } from "./maintenance-jobs.worker"
import { MaintenanceJobsRegistryModule } from "./maintenance-jobs-registry.module"

@Module({
  imports: [
    BullModule.registerQueue({ name: MAINTENANCE_JOBS_QUEUE_NAME }),
    MaintenanceJobsRegistryModule,
  ],
  providers: [MaintenanceJobsWorker],
})
export class MaintenanceJobsWorkersModule {}
