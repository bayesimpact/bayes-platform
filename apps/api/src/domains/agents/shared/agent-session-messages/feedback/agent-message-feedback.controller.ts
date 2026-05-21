import {
  type AgentMessageFeedbackDto,
  AgentMessageFeedbackRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import type { Agent } from "@/domains/agents/agent.entity"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { DocumentsGuard } from "@/domains/documents/documents.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import { AgentGuard } from "../../../agent.guard"
import type { AgentMessage } from "../agent-message.entity"
import type { AgentMessageFeedback } from "./agent-message-feedback.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMessageFeedbackService } from "./agent-message-feedback.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard)
@RequireContext("organization", "project")
@Controller()
export class AgentMessageFeedbackController {
  constructor(private readonly feedbackService: AgentMessageFeedbackService) {}

  @CheckPolicy((policy) => policy.canCreate())
  @Post(AgentMessageFeedbackRoutes.createOne.path)
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Param("agentMessageId") agentMessageId: string,
    @Body() { payload }: typeof AgentMessageFeedbackRoutes.createOne.request,
  ): Promise<typeof AgentMessageFeedbackRoutes.createOne.response> {
    const user = request.user

    const feedback = await this.feedbackService.createFeedback({
      connectScope: getRequiredConnectScope(request),
      userId: user.id,
      agentMessageId,
      content: payload.content,
    })

    if (!feedback) throw new Error("Failed to create feedback")

    return { data: { success: true } }
  }

  @UseGuards(AgentGuard, DocumentsGuard) // FIXME: create dedicated guard because a "member" of an agent should not have access to feedbacks
  @AddContext("agent")
  @CheckPolicy((policy) => policy.canList())
  @Get(AgentMessageFeedbackRoutes.getAll.path)
  async getAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentMessageFeedbackRoutes.getAll.response> {
    if (request.agent.type !== "conversation" && request.agent.type !== "form") {
      throw new Error("Unsupported agent type")
    }
    const data = await this.feedbackService.listFeedbacksForAgent({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
    })

    return {
      data: {
        feedbacks: toDto({
          agentMessageEntities: data.agentMessages,
          agentMessageFeedbackEntities: data.agentMessageFeedbacks,
          agentId: request.agent.id,
          agentType: request.agent.type,
        }),
      },
    }
  }
}

function toDto({
  agentMessageEntities,
  agentMessageFeedbackEntities,
  agentId,
  agentType,
}: {
  agentMessageEntities: AgentMessage[]
  agentMessageFeedbackEntities: AgentMessageFeedback[]
  agentId: string
  agentType: Agent["type"]
}): AgentMessageFeedbackDto[] {
  return agentMessageFeedbackEntities
    .map((f) => {
      const agentMessage = agentMessageEntities.find((m) => m.id === f.agentMessageId)
      const traceUrl = agentMessage?.session(agentType)?.traceId
        ? getTraceUrl(agentMessage.session(agentType)!.traceId)
        : undefined
      if (!agentMessage) return null
      return {
        id: f.id,
        organizationId: f.organizationId,
        projectId: f.projectId,
        agentId,
        agentSessionId: agentMessage.sessionId,
        agentMessageId: f.agentMessageId,
        agentMessageContent: agentMessage.content,
        userId: f.userId,
        content: f.content,
        createdAt: f.createdAt.getTime(),
        traceUrl,
      } satisfies AgentMessageFeedbackDto
    })
    .filter((f) => f !== null)
}
