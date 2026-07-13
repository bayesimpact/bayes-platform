import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { User } from "@/domains/users/user.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "./memberships/organization-memberships.service"
import { Organization } from "./organization.entity"

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) readonly organizationRepository: Repository<Organization>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
  ) {}

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    return this.organizationMembershipsService.listOrganizationsForUser(userId)
  }

  async createOrganization({
    userId,
    name,
  }: {
    userId: string
    name: string
  }): Promise<Organization> {
    if (!name || name.trim().length < 3) {
      throw new Error("Organization name must be at least 3 characters long")
    }

    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user) {
      throw new Error(`User with id ${userId} not found`)
    }

    const organization = this.organizationRepository.create({ name })
    const savedOrganization = await this.organizationRepository.save(organization)

    await this.organizationMembershipsService.createOrganizationOwnerMembership({
      userId: user.id,
      organizationId: savedOrganization.id,
    })

    return savedOrganization
  }

  async updateOrganizationName({
    organizationId,
    name,
  }: {
    organizationId: string
    name: string
  }): Promise<void> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    })
    if (!organization) {
      throw new NotFoundException(`Organization ${organizationId} not found`)
    }

    organization.name = name
    await this.organizationRepository.save(organization)
  }
}
