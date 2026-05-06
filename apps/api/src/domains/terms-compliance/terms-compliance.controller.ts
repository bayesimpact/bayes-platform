import { BackofficeRoutes, MeRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Post, Put, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { toCurrentTermsDto } from "./terms-compliance.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TermsComplianceService } from "./terms-compliance.service"
import { TermsManagementGuard } from "./terms-management.guard"

@UseGuards(JwtAuthGuard, UserGuard)
@Controller()
export class TermsComplianceController {
  constructor(private readonly termsComplianceService: TermsComplianceService) {}

  @Post(MeRoutes.acceptTerms.path)
  async acceptTerms(
    @Req() request: EndpointRequest,
    @Body() body: typeof MeRoutes.acceptTerms.request,
  ): Promise<typeof MeRoutes.acceptTerms.response> {
    await this.termsComplianceService.recordAcceptance({
      userId: request.user.id,
      aiUsagePolicyAccepted: body.payload.aiUsagePolicyAccepted === true,
    })
    return { data: { success: true } }
  }

  // BACKOFFICE
  @UseGuards(TermsManagementGuard)
  @Get(BackofficeRoutes.listTermsDocuments.path)
  async listTermsDocuments(): Promise<typeof BackofficeRoutes.listTermsDocuments.response> {
    const documents = await this.termsComplianceService.listTermsDocuments()
    return { data: { documents: toCurrentTermsDto(documents) } }
  }

  // BACKOFFICE
  @UseGuards(TermsManagementGuard)
  @Put(BackofficeRoutes.updateTermsDocuments.path)
  async updateTermsDocuments(
    @Body() body: typeof BackofficeRoutes.updateTermsDocuments.request,
  ): Promise<typeof BackofficeRoutes.updateTermsDocuments.response> {
    const documents = await this.termsComplianceService.updateTermsDocuments(body.payload)
    return { data: { documents: toCurrentTermsDto(documents) } }
  }
}
