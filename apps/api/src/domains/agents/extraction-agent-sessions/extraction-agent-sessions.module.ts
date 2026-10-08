import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { RbacModule } from "@/domains/rbac/rbac.module"
import {
  moduleFeatures,
  moduleImports,
  moduleProviders,
} from "../base-agent-sessions/base-agent-sessions-module.helpers"
import { ExtractionAgentSessionBatchModule } from "./extraction-agent-session-batch.module"
import { ExtractionAgentSessionStatusStreamService } from "./extraction-agent-session-status-stream.service"
import { ExtractionAgentSessionsService } from "./extraction-agent-sessions.service"
import { LiveExtractionAgentSessionsController } from "./live-extraction-agent-sessions.controller"
import { PlaygroundExtractionAgentSessionsController } from "./playground-extraction-agent-sessions.controller"

@Module({
  imports: [
    TypeOrmModule.forFeature([...moduleFeatures]),
    ...moduleImports,
    ExtractionAgentSessionBatchModule,
    RbacModule,
  ],
  providers: [
    ...moduleProviders,
    ExtractionAgentSessionsService,
    ExtractionAgentSessionStatusStreamService,
  ],
  controllers: [LiveExtractionAgentSessionsController, PlaygroundExtractionAgentSessionsController],
  exports: [ExtractionAgentSessionsService],
})
export class ExtractionAgentSessionsModule {}
