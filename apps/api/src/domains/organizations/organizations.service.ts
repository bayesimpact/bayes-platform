import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { User } from "@/domains/users/user.entity"
import { OrganizationMembership } from "./memberships/organization-membership.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipService } from "./memberships/organization-membership.service"
import { Organization } from "./organization.entity"

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly organizationMembershipRepository: Repository<OrganizationMembership>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly organizationMembershipService: OrganizationMembershipService,
  ) {}

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    // Use query builder to ensure proper join and handle potential null organizations
    const memberships = await this.organizationMembershipRepository
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.organization", "organization")
      .where("membership.userId = :userId", { userId })
      .getMany()

    return memberships.map((membership) => membership.organization)
  }

  async createOrganization({
    userId,
    name,
  }: {
    userId: string
    name: string
  }): Promise<Organization> {
    // Validate organization name (defense in depth)
    if (!name || name.trim().length < 3) {
      throw new Error("Organization name must be at least 3 characters long")
    }

    // Verify user exists and get entity reference (required for foreign key constraint)
    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user) {
      throw new Error(`User with id ${userId} not found`)
    }

    // Create the organization
    const organization = this.organizationRepository.create({ name })
    const savedOrganization = await this.organizationRepository.save(organization)

    await this.organizationMembershipService.createOrganizationOwnerMembership({
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
