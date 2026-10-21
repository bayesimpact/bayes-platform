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
import type { ProjectRoleOption } from "./members-table.models"

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

  const membersLabel = memberCount === 1 ? "1 member" : `${memberCount} members`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add roles to {membersLabel}</DialogTitle>
          <DialogDescription>
            The roles add to the ones they already hold. Their permissions on this workspace change
            right away.
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
                <Label htmlFor={id}>{role.name}</Label>
              </div>
            )
          })}
        </fieldset>

        {showEmptyChoice && <p className="text-sm text-destructive">Pick at least one role.</p>}
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
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isConfirming}>
            Add roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
