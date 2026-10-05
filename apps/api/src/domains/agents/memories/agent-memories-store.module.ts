import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { AgentMemoriesService } from "./agent-memories.service"
import { AgentMemory } from "./agent-memory.entity"
import { AgentMemoryRepository } from "./agent-memory.repository"

/**
 * The memory store alone, without routes: the agent tools and the retention
 * workers import it; AgentMemoriesModule adds the user-facing routes.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AgentMemory])],
  providers: [AgentMemoriesService, AgentMemoryRepository],
  exports: [AgentMemoriesService],
})
export class AgentMemoriesStoreModule {}
