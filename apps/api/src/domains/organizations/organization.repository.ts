import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { Project } from "@/domains/projects/project.entity"
import { Organization } from "./organization.entity"
import type { OrganizationProjectModel } from "./organization.model"

@Injectable()
export class OrganizationRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findByIds(organizationIds: string[]): Promise<Organization[]> {
    if (organizationIds.length === 0) {
      return []
    }

    return this.organizationRepo().find({
      where: { id: In(organizationIds) },
      order: { createdAt: "DESC" },
    })
  }

  async findProjectsByOrganizationIds(organizationIds: string[]): Promise<Project[]> {
    if (organizationIds.length === 0) {
      return []
    }

    return this.projectRepo().find({
      where: { organizationId: In(organizationIds) },
      relations: { featureFlags: true },
      order: { createdAt: "DESC" },
    })
  }

  async findProjectsByIdsInOrganizations({
    projectIds,
    organizationIds,
  }: {
    projectIds: string[]
    organizationIds: string[]
  }): Promise<Project[]> {
    if (projectIds.length === 0 || organizationIds.length === 0) {
      return []
    }

    return this.projectRepo().find({
      where: { id: In(projectIds), organizationId: In(organizationIds) },
      relations: { featureFlags: true },
      order: { createdAt: "DESC" },
    })
  }

  toProjectModel(project: Project): OrganizationProjectModel {
    return {
      id: project.id,
      name: project.name,
      featureFlags: (project.featureFlags ?? [])
        .filter((featureFlag) => featureFlag.enabled)
        .map((featureFlag) => featureFlag.featureFlagKey),
    }
  }

  private organizationRepo(): Repository<Organization> {
    return this.transactionService.getManager().getRepository(Organization)
  }

  private projectRepo(): Repository<Project> {
    return this.transactionService.getManager().getRepository(Project)
  }
}
