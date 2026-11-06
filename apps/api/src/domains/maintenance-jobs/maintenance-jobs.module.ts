import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { getBullMqConnection } from "@/bullmq.config"
import { AuthModule } from "@/domains/auth/auth.module"
import { BackofficeGuard } from "@/domains/backoffice/backoffice.guard"
import { RbacModule } from "@/domains/rbac/rbac.module"
import { UsersModule } from "@/domains/users/users.module"
import { MAINTENANCE_JOBS_QUEUE_NAME } from "./maintenance-jobs.constants"
import { MaintenanceJobsController } from "./maintenance-jobs.controller"
import { MaintenanceJobsService } from "./maintenance-jobs.service"
import { MaintenanceJobsRegistryModule } from "./maintenance-jobs-registry.module"

/** The backoffice side of the maintenance jobs: list them and start a run. The workers run it. */
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({ connection: getBullMqConnection() }),
    }),
    BullModule.registerQueue({ name: MAINTENANCE_JOBS_QUEUE_NAME }),
    MaintenanceJobsRegistryModule,
    UsersModule,
    AuthModule,
    RbacModule,
  ],
  controllers: [MaintenanceJobsController],
  providers: [MaintenanceJobsService, BackofficeGuard],
})
export class MaintenanceJobsModule {}
