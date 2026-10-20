import { DeskAccountRoutes } from "@caseai-connect/desk-contracts"
import { Controller, Req } from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import { SIGNED_IN } from "@/common/schema-route/schema-route.decorator"
import { DeskRoute } from "../desk-route.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DeskAccountService } from "./desk-account.service"

@Controller()
export class DeskAccountController {
  constructor(private readonly deskAccountService: DeskAccountService) {}

  @DeskRoute(DeskAccountRoutes.getMe, { permission: SIGNED_IN })
  async getMe(@Req() request: EndpointRequest): Promise<typeof DeskAccountRoutes.getMe.response> {
    return { data: await this.deskAccountService.getMe(request.user) }
  }
}
