import { EvaluationConversationTestCasesRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithProject } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import {
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationTestCasesService } from "./evaluation-conversation-test-cases.service"

// Saving a test case adds a record to a dataset, so every route asks for the right to change
// the project's datasets. The answer it starts from can come from any session of the project.
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationConversationTestCasesController {
  constructor(
    private readonly testCasesService: EvaluationConversationTestCasesService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post(EvaluationConversationTestCasesRoutes.createOne.path)
  @CheckPermission(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationConversationTestCase.create" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationConversationTestCasesRoutes.createOne.request,
  ): Promise<typeof EvaluationConversationTestCasesRoutes.createOne.response> {
    if (payload.datasetId === null) {
      const canCreateDataset = await this.permissionService.has(
        request.user.id,
        EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
        { type: "project", id: request.project.id },
      )
      if (!canCreateDataset) {
        throw new ForbiddenException("You cannot create a dataset in this project")
      }
    }
    const testCase = await this.testCasesService.createTestCase({
      connectScope: getRequiredConnectScope(request),
      datasetId: payload.datasetId,
      newDatasetName: payload.newDatasetName,
      input: payload.input,
      expectedOutput: payload.expectedOutput,
      comment: payload.comment,
    })
    return { data: testCase }
  }

  // The drafting routes read a conversation, maybe someone else's, so each read is logged in the
  // activity journal with the session it opened, as on the conversation review page.

  @Post(EvaluationConversationTestCasesRoutes.draftInput.path)
  @CheckPermission(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, "project")
  @TrackActivity({
    action: "evaluationConversationTestCase.draftInput",
    entityFrom: "agentSession",
  })
  async draftInput(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationConversationTestCasesRoutes.draftInput.request,
  ): Promise<typeof EvaluationConversationTestCasesRoutes.draftInput.response> {
    const { draft, agentSessionId } = await this.testCasesService.draftInput({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentMessageId: payload.agentMessageId,
      inputMode: payload.inputMode,
    })
    attachTrackedActivity(request, { entityFrom: "agentSession", entityId: agentSessionId })
    return { data: draft }
  }

  @Post(EvaluationConversationTestCasesRoutes.draftExpectedOutput.path)
  @CheckPermission(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, "project")
  @TrackActivity({
    action: "evaluationConversationTestCase.draftExpectedOutput",
    entityFrom: "agentSession",
  })
  async draftExpectedOutput(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationConversationTestCasesRoutes.draftExpectedOutput.request,
  ): Promise<typeof EvaluationConversationTestCasesRoutes.draftExpectedOutput.response> {
    const { draft, agentSessionId } = await this.testCasesService.draftExpectedOutput({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentMessageId: payload.agentMessageId,
      comment: payload.comment,
    })
    attachTrackedActivity(request, { entityFrom: "agentSession", entityId: agentSessionId })
    return { data: { expectedOutput: draft } }
  }

  @Post(EvaluationConversationTestCasesRoutes.anonymize.path)
  @CheckPermission(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationConversationTestCase.anonymize", entityFrom: "agentSession" })
  async anonymize(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationConversationTestCasesRoutes.anonymize.request,
  ): Promise<typeof EvaluationConversationTestCasesRoutes.anonymize.response> {
    const { draft, agentSessionId } = await this.testCasesService.anonymize({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentMessageId: payload.agentMessageId,
      text: payload.text,
    })
    attachTrackedActivity(request, { entityFrom: "agentSession", entityId: agentSessionId })
    return { data: { text: draft } }
  }
}
