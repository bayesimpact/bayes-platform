import type { BaseAgentSessionTypeDto } from "@caseai-connect/api-contracts"
import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"

/**
 * Who may upload and list the documents an extraction agent runs on. The rules follow the run
 * itself (see `BaseAgentSessionPolicy`): a live run is open to every project member, a playground
 * run to project admins and owners only.
 *
 * The routes it guards create or list documents and never act on one, so it carries no entity.
 */
export class ExtractionAgentDocumentPolicy extends ProjectScopedPolicy<unknown> {
  constructor(
    context: ConstructorParameters<typeof ProjectScopedPolicy<unknown>>[0],
    entity?: unknown,
    private readonly type?: BaseAgentSessionTypeDto,
  ) {
    super(context, entity)
  }

  canList(): boolean {
    return this.canAccessForType()
  }

  canCreate(): boolean {
    return this.canAccessForType()
  }

  private canAccessForType(): boolean {
    if (this.type === "live") {
      return this.canAccess()
    }
    return this.canAccess() && this.isProjectAdminOrOwner()
  }
}
