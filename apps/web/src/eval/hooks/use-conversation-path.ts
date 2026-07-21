import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import { EvalRoutes } from "../routes/helpers"

export function useConversationPath() {
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)

  const buildConversationPath = (): string => {
    return EvalRoutes.conversation.build({ organizationId, projectId })
  }
  return { buildConversationPath }
}
