import { BullModule, getQueueToken } from "@nestjs/bullmq"
import { type DynamicModule, Module } from "@nestjs/common"
import { WORKERS_HEALTH_QUEUE, WorkersHealthController } from "./workers-health.controller"

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (`forRoot`)
export class WorkersHealthModule {
  /**
   * Registers the /healthz controller, pinging the given BullMQ queue for the
   * Redis readiness check. Each worker pool passes a queue it actually owns
   * (embeddings for the GPU pool, extraction-run for the CPU pool).
   */
  static forRoot(queueName: string): DynamicModule {
    return {
      module: WorkersHealthModule,
      imports: [BullModule.registerQueue({ name: queueName })],
      controllers: [WorkersHealthController],
      providers: [{ provide: WORKERS_HEALTH_QUEUE, useExisting: getQueueToken(queueName) }],
    }
  }
}
