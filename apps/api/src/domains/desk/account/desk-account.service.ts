import { DESK_UI_READ_PERMISSION } from "@caseai-connect/api-contracts"
import type { MeOutputDto } from "@caseai-connect/desk-contracts"
import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationsService } from "@/domains/organizations/organizations.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectsService } from "@/domains/projects/projects.service"
import { type DeskUser, toMeOutputDto } from "./desk-account.mapper"

@Injectable()
export class DeskAccountService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /** The caller and the projects where they hold `desk.ui.read`, for the Desk's home. */
  async getMe(user: DeskUser): Promise<MeOutputDto> {
    const [projects, organizations] = await Promise.all([
      this.projectsService.listUserProjects(user.id),
      this.organizationsService.listOrganizations(user.id),
    ])
    return toMeOutputDto({
      user,
      projects: projects.filter((project) => project.hasPermission(DESK_UI_READ_PERMISSION)),
      organizations,
    })
  }
}
