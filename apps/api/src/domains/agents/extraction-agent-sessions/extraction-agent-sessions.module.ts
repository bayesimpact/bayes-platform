import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "../base-agent-sessions/base-agent-sessions-module.helpers"
import { ExtractionAgentSessionBatchModule } from "./extraction-agent-session-batch.module"
import { ExtractionAgentSessionStatusStreamService } from "./extraction-agent-session-status-stream.service"
import { ExtractionAgentSessionsController } from "./extraction-agent-sessions.controller"
import { ExtractionAgentSessionsService } from "./extraction-agent-sessions.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures]),
    ...moduleImports,
    ExtractionAgentSessionBatchModule,
  ],
  providers: [
    ...moduleProviders,
    ExtractionAgentSessionsService,
    ExtractionAgentSessionStatusStreamService,
  ],
  controllers: [ExtractionAgentSessionsController],
  exports: [ExtractionAgentSessionsService],
})
export class ExtractionAgentSessionsModule {}
