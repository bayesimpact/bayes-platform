import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Label } from "@caseai-connect/ui/shad/label"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { ProjectRoleOption } from "./members-table.models"
import { useRoleLabel } from "./role-label"

/** Picks the workspace roles to add to the selected members, and confirms the change. */
export function AddRolesDialog({
  open,
  memberCount,
  roles,
  onConfirm,
  onCancel,
  error,
  isConfirming = false,
}: {
  open: boolean
  memberCount: number
  roles: ProjectRoleOption[]
  onConfirm: (roleKeys: string[]) => void
  onCancel: () => void
  error?: string | null
  isConfirming?: boolean
}) {
  const { t } = useTranslation()
  const roleLabel = useRoleLabel()
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>([])
  const [showEmptyChoice, setShowEmptyChoice] = useState(false)

  const toggleRole = (roleKey: string, checked: boolean) => {
    setShowEmptyChoice(false)
    setSelectedRoleKeys((current) =>
      checked ? [...current, roleKey] : current.filter((key) => key !== roleKey),
    )
  }

  const handleConfirm = () => {
    if (selectedRoleKeys.length === 0) {
      setShowEmptyChoice(true)
      return
    }
    onConfirm(selectedRoleKeys)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) return
    setSelectedRoleKeys([])
    setShowEmptyChoice(false)
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("projectMembership:table.addRolesDialog.title", { count: memberCount })}
          </DialogTitle>
          <DialogDescription>
            {t("projectMembership:table.addRolesDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-3" disabled={isConfirming}>
          {roles.map((role) => {
            const id = `add-role-${role.key}`
            return (
              <div key={role.key} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={selectedRoleKeys.includes(role.key)}
                  onCheckedChange={(checked) => toggleRole(role.key, checked === true)}
                />
                <Label htmlFor={id}>{roleLabel(role)}</Label>
              </div>
            )
          })}
        </fieldset>

        {showEmptyChoice && (
          <p className="text-sm text-destructive">
            {t("projectMembership:table.addRolesDialog.pickOne")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isConfirming}
          >
            {t("actions:cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isConfirming}>
            {t("projectMembership:table.addRoles")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
