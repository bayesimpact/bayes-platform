import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { WORKERS_HEALTH_QUEUE_NAME } from "./workers-health.constants"
import { WorkersHealthController } from "./workers-health.controller"

@Module({
  imports: [
    BullModule.registerQueue({
      name: WORKERS_HEALTH_QUEUE_NAME,
    }),
  ],
  controllers: [WorkersHealthController],
})
export class WorkersHealthModule {}
