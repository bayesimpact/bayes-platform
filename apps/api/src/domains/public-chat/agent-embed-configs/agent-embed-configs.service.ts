import crypto from "node:crypto"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AgentEmbedConfig } from "./agent-embed-config.entity"

@Injectable()
export class AgentEmbedConfigsService {
  constructor(
    @InjectRepository(AgentEmbedConfig)
    private readonly agentEmbedConfigRepository: Repository<AgentEmbedConfig>,
  ) {}

  async findByEmbedToken(embedToken: string): Promise<AgentEmbedConfig | null> {
    return this.agentEmbedConfigRepository.findOne({ where: { embedToken } })
  }

  async findByAgentId(agentId: string): Promise<AgentEmbedConfig | null> {
    return this.agentEmbedConfigRepository.findOne({ where: { agentId } })
  }

  async findByAgentIdOrFail(agentId: string): Promise<AgentEmbedConfig> {
    const config = await this.findByAgentId(agentId)
    if (!config) throw new NotFoundException(`Embed config not found for agent ${agentId}`)
    return config
  }

  async upsert(params: {
    agentId: string
    organizationId: string
    projectId: string
  }): Promise<AgentEmbedConfig> {
    let config = await this.findByAgentId(params.agentId)
    if (!config) {
      config = this.agentEmbedConfigRepository.create({
        agentId: params.agentId,
        organizationId: params.organizationId,
        projectId: params.projectId,
        embedToken: crypto.randomUUID(),
        isEnabled: false,
        allowedOrigins: [],
      })
    }
    return this.agentEmbedConfigRepository.save(config)
  }

  async update(
    agentId: string,
    fields: Partial<Pick<AgentEmbedConfig, "isEnabled" | "allowedOrigins">>,
  ): Promise<AgentEmbedConfig> {
    const config = await this.findByAgentIdOrFail(agentId)
    Object.assign(config, fields)
    return this.agentEmbedConfigRepository.save(config)
  }
}
