import { PUBLIC_DOCUMENTS_TAG_NAME } from "@caseai-connect/api-contracts"
import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { Document } from "./document.entity"

export class DocumentPolicy extends ProjectScopedPolicy<Document> {
  constructor(
    context: ConstructorParameters<typeof ProjectScopedPolicy<Document>>[0],
    entity?: Document,
    private readonly sourceType?: Document["sourceType"],
  ) {
    super(context, entity)
  }

  canList(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }
  canView(): boolean {
    return this.canAccess()
  }

  /**
   * Downloading a document yields a temporary file URL. Admins and owners can
   * download any document in the project (studio access). Regular members can
   * only download documents explicitly tagged `public-documents`, which is the
   * single tag that exposes downloadable sources in chat.
   */
  canDownload(): boolean {
    if (!this.canAccess()) return false
    if (this.isProjectAdminOrOwner()) return true
    return this.isPublicDocument()
  }

  private isPublicDocument(): boolean {
    return this.entity?.tags?.some((tag) => tag.name === PUBLIC_DOCUMENTS_TAG_NAME) ?? false
  }

  canCreate(): boolean {
    if (this.sourceType && ["agentSessionMessage", "extraction"].includes(this.sourceType)) {
      return this.canAccess()
    }
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canUpdate(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner() && this.doesResourceBelongToScope()
  }

  canDelete(): boolean {
    return this.canUpdate()
  }
}
