import { Injectable, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipRepository } from "@/domains/projects/memberships/project-membership.repository"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithProjectMembership } from "../request.interface"

@Injectable()
export class ProjectMembershipContextResolver implements ContextResolver {
  readonly resource = "projectMembership" as const

  constructor(private readonly projectMembershipRepository: ProjectMembershipRepository) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { membershipId?: string }
    }
    const membershipId = requestWithParams.params?.membershipId

    if (!membershipId || membershipId === ":membershipId") throw new NotFoundException()

    const requestWithProjectMembership = request as EndpointRequestWithProjectMembership
    const memberProjectMembership =
      (await this.projectMembershipRepository.findById({
        membershipId,
        projectId: requestWithProjectMembership.project.id,
      })) ?? undefined
    if (!memberProjectMembership) throw new NotFoundException()

    requestWithProjectMembership.memberProjectMembership = memberProjectMembership
  }
}
