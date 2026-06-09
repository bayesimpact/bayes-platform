import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { getBullMqConnection } from "./bullmq.config"
import typeorm from "./config/typeorm"

/**
 * Shared infrastructure wiring for every worker process (GPU and CPU pools).
 *
 * Holds the ConfigModule / TypeORM datasource / BullMQ connection setup that
 * each worker root module needs verbatim, so the two pools stay in sync.
 * ConfigModule is global, so it is visible everywhere once this module is imported.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => configService.get("typeorm")(),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        connection: getBullMqConnection(),
      }),
    }),
  ],
})
export class WorkersSharedModule {}
