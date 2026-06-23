import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "../base-agent-sessions/base-agent-sessions-module.helpers"
import { ExtractionAgentSessionStatusNotifierService } from "./extraction-agent-session-status-notifier.service"
import { ExtractionAgentSessionStatusStreamService } from "./extraction-agent-session-status-stream.service"
import { ExtractionAgentSessionsController } from "./extraction-agent-sessions.controller"
import { ExtractionAgentSessionsService } from "./extraction-agent-sessions.service"

@Module({
  imports: [TypeOrmModule.forFeature([...moduleFeatures]), ...moduleImports],
  providers: [
    ...moduleProviders,
    ExtractionAgentSessionsService,
    ExtractionAgentSessionStatusStreamService,
    ExtractionAgentSessionStatusNotifierService,
  ],
  controllers: [ExtractionAgentSessionsController],
  exports: [ExtractionAgentSessionsService],
})
export class ExtractionAgentSessionsModule {}
