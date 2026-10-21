import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { AUTH_ERRORS } from "@/common/errors/auth-errors"
import { groupMembershipRows } from "@/domains/memberships/membership-roles"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { OrganizationMembershipContextModel } from "@/domains/organizations/memberships/organization-membership.model"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithOrganizationMembership } from "../request.interface"

@Injectable()
export class OrganizationContextResolver implements ContextResolver {
  readonly resource = "organization" as const

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { organizationId?: string }
    }
    const organizationId = requestWithParams.params?.organizationId
    if (!organizationId || organizationId === ":organizationId") {
      throw new BadRequestException(AUTH_ERRORS.NO_ORGANIZATION_ID)
    }

    const userMembershipRows = await this.dataSource.getRepository(UserMembership).find({
      where: {
        userId: request.user.id,
        resourceId: organizationId,
        resourceType: "organization",
      },
      relations: { rbacRole: true },
    })
    const [group] = groupMembershipRows(userMembershipRows)
    if (!group) {
      throw new UnauthorizedException(AUTH_ERRORS.NOT_MEMBER_OF_ORG)
    }

    const organizationMembership = {
      id: group.oldest.id,
      userId: group.oldest.userId,
      organizationId,
      roles: group.roles,
      createdAt: group.oldest.createdAt,
      updatedAt: group.updatedAt,
      deletedAt: group.oldest.deletedAt,
    } satisfies OrganizationMembershipContextModel

    const requestWithMembership = request as EndpointRequestWithOrganizationMembership
    requestWithMembership.organizationId = organizationId
    requestWithMembership.organizationMembership = organizationMembership
  }
}
