import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { PlusIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { ProjectAgentSessionCategory } from "@/common/features/projects/projects.models"
import { useAppDispatch } from "@/common/store/hooks"
import {
  addProjectAgentSessionCategory,
  deleteProjectAgentSessionCategory,
} from "@/studio/features/projects/projects.thunks"

export function ProjectAgentSessionCategoriesForm({
  categories,
}: {
  categories: ProjectAgentSessionCategory[]
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [assignToAllConversationalAgents, setAssignToAllConversationalAgents] = useState(false)
  const [categoryToRemove, setCategoryToRemove] = useState<ProjectAgentSessionCategory | null>(null)

  const handleAddCategory = async () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) return
    await dispatch(
      addProjectAgentSessionCategory({ name: trimmedName, assignToAllConversationalAgents }),
    )
    setNewCategoryName("")
    setAssignToAllConversationalAgents(false)
    setIsAddDialogOpen(false)
  }

  const handleRemoveCategory = async (categoryToDelete: ProjectAgentSessionCategory) => {
    await dispatch(deleteProjectAgentSessionCategory({ categoryId: categoryToDelete.id }))
    setCategoryToRemove(null)
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("projectAdmin:agentSessionCategories.title")}</FieldLabel>
        <FieldDescription>{t("projectAdmin:agentSessionCategories.description")}</FieldDescription>

        <div className="flex flex-wrap gap-2 mt-2">
          {categories.map((category) => (
            <Badge key={category.id} variant="secondary" className="gap-1 pr-1 text-sm">
              {category.name}
              <button
                type="button"
                onClick={() => setCategoryToRemove(category)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={t("projectAdmin:agentSessionCategories.removeCategory", {
                  name: category.name,
                })}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("projectAdmin:agentSessionCategories.empty")}
            </p>
          )}
        </div>
      </Field>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setIsAddDialogOpen(true)}
      >
        <PlusIcon className="mr-2 h-4 w-4" />
        {t("projectAdmin:agentSessionCategories.addCategory")}
      </Button>

      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) {
            setNewCategoryName("")
            setAssignToAllConversationalAgents(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projectAdmin:agentSessionCategories.addDialogTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder={t("projectAdmin:agentSessionCategories.categoryNamePlaceholder")}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddCategory()
            }}
            autoFocus
          />
          <label htmlFor="assign-to-all" className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              id="assign-to-all"
              checked={assignToAllConversationalAgents}
              onCheckedChange={(checked) => setAssignToAllConversationalAgents(checked === true)}
            />
            {t("projectAdmin:agentSessionCategories.assignToAllConversationalAgents")}
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              {t("actions:cancel")}
            </Button>
            <Button type="button" onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              {t("actions:add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryToRemove !== null} onOpenChange={() => setCategoryToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projectAdmin:agentSessionCategories.removeDialogTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("projectAdmin:agentSessionCategories.removeDialogDescription", {
              name: categoryToRemove?.name,
            })}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategoryToRemove(null)}>
              {t("actions:cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => categoryToRemove && handleRemoveCategory(categoryToRemove)}
            >
              {t("actions:remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FieldGroup>
  )
}
