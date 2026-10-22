import { useTranslation } from "react-i18next"
import type { ProjectRoleOption } from "./members-table.models"

/** A workspace role's label in the viewer's language, or its catalog name for a role we do not translate. */
export function useRoleLabel(): (role: ProjectRoleOption) => string {
  const { t } = useTranslation()
  return (role) => t(`projectMembership:roleNames.${role.key}`, { defaultValue: role.name })
}
