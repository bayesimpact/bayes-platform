import {
  AppsV1Routes,
  createAppDocumentSchema,
  DOCUMENT_CREATE_PERMISSION,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DocumentsService } from "@/domains/documents/documents.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AppGuard } from "./app.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsService } from "./apps.service"

@Controller()
export class AppsV1Controller {
  constructor(
    private readonly appsService: AppsService,
    private readonly documentsService: DocumentsService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  @Post(AppsV1Routes.createToken.path)
  @HttpCode(HttpStatus.OK)
  async createToken(@Body() body: unknown): Promise<typeof AppsV1Routes.createToken.response> {
    const token = await this.appsService.issueToken(body)
    return {
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
    }
  }

  @UseGuards(AppGuard)
  @Get(AppsV1Routes.getMe.path)
  getMe(
    @Req() request: EndpointRequest & { appInstallationId: string; appProjectId: string },
  ): typeof AppsV1Routes.getMe.response {
    return {
      data: {
        userId: request.user.id,
        projectId: request.appProjectId,
        installationId: request.appInstallationId,
      },
    }
  }

  @UseGuards(AppGuard, CheckPermissionGuard)
  @CheckPermission(DOCUMENT_CREATE_PERMISSION, "project")
  @Post(AppsV1Routes.createDocument.path)
  @HttpCode(HttpStatus.CREATED)
  async createDocument(
    @Param("projectId") projectId: string,
    @Req() request: EndpointRequest & { appProjectId: string },
    @Body() body: unknown,
  ): Promise<typeof AppsV1Routes.createDocument.response> {
    if (projectId !== request.appProjectId) {
      throw new ForbiddenException("Project does not match the access token")
    }

    const parsed = createAppDocumentSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid document payload")
    }

    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`)
    }

    const document = await this.documentsService.createInlineProjectDocument({
      connectScope: { organizationId: project.organizationId, projectId: project.id },
      userId: request.user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      sourceUrl: parsed.data.source_url ?? null,
    })

    return {
      data: {
        id: document.id,
        title: document.title,
        projectId: document.projectId,
        sourceUrl: document.sourceUrl,
        embeddingStatus: document.embeddingStatus,
      },
    }
  }
}
