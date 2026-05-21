import crypto from "node:crypto"
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { PublicAgentSession } from "../public-agent-sessions/public-agent-session.entity"
import type { PublicChatSessionRequest } from "../public-chat.request"

@Injectable()
export class PublicSessionTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(PublicAgentSession)
    private readonly publicAgentSessionRepository: Repository<PublicAgentSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicChatSessionRequest>()
    const sessionToken = request.headers["x-session-token"]

    if (!sessionToken || typeof sessionToken !== "string") {
      throw new UnauthorizedException("Missing session token")
    }

    const sessionId = request.params.sessionId
    if (!sessionId) {
      throw new UnauthorizedException("Missing session ID")
    }

    const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

    const publicSession = await this.publicAgentSessionRepository.findOne({
      where: { id: sessionId, sessionTokenHash: tokenHash },
    })

    if (!publicSession) {
      throw new UnauthorizedException("Invalid session token")
    }

    if (publicSession.agentId !== request.agent.id) {
      throw new UnauthorizedException("Session does not belong to this agent")
    }

    request.publicSession = publicSession
    return true
  }
}
