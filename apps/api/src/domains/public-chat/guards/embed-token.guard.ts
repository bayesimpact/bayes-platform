import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import type { PublicChatRequest } from "../public-chat.request"

@Injectable()
export class EmbedTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicChatRequest>()
    const embedToken = request.params.embedToken

    if (!embedToken) {
      throw new UnauthorizedException("Missing embed token")
    }

    const agent = await this.agentRepository.findOne({ where: { embedToken } })

    if (!agent) {
      throw new UnauthorizedException("Invalid embed token")
    }

    if (!agent.embedEnabled) {
      throw new ForbiddenException("Embed access is disabled for this agent")
    }

    const origin = request.headers.origin
    if (
      agent.embedAllowedOrigins.length > 0 &&
      origin &&
      !agent.embedAllowedOrigins.includes(origin)
    ) {
      throw new ForbiddenException("Origin not allowed")
    }

    request.agent = agent
    return true
  }
}
