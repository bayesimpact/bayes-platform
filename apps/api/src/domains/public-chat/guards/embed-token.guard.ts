import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import type { PublicChatRequest } from "../public-chat.request"

@Injectable()
export class EmbedTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(AgentEmbedConfig)
    private readonly agentEmbedConfigRepository: Repository<AgentEmbedConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicChatRequest>()
    const embedToken = request.params.embedToken

    if (!embedToken) {
      throw new UnauthorizedException("Missing embed token")
    }

    const embedConfig = await this.agentEmbedConfigRepository.findOne({
      where: { embedToken },
    })

    if (!embedConfig) {
      throw new UnauthorizedException("Invalid embed token")
    }

    if (!embedConfig.isEnabled) {
      throw new ForbiddenException("Embed access is disabled for this agent")
    }

    const origin = request.headers.origin
    if (
      embedConfig.allowedOrigins.length > 0 &&
      origin &&
      !embedConfig.allowedOrigins.includes(origin)
    ) {
      throw new ForbiddenException("Origin not allowed")
    }

    request.embedConfig = embedConfig
    return true
  }
}
