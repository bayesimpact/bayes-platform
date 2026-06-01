import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
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
import type { ProjectAgentCategory } from "@/common/features/projects/projects.models"
import { useAppDispatch } from "@/common/store/hooks"
import {
  addProjectAgentCategory,
  deleteProjectAgentCategory,
} from "@/studio/features/projects/projects.thunks"

export function ProjectAgentCategoriesForm({ categories }: { categories: ProjectAgentCategory[] }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [categoryToRemove, setCategoryToRemove] = useState<ProjectAgentCategory | null>(null)

  const handleAddCategory = async () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) return
    await dispatch(addProjectAgentCategory({ name: trimmedName }))
    setNewCategoryName("")
    setIsAddDialogOpen(false)
  }

  const handleRemoveCategory = async (categoryToDelete: ProjectAgentCategory) => {
    await dispatch(deleteProjectAgentCategory({ categoryId: categoryToDelete.id }))
    setCategoryToRemove(null)
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("projectAdmin:agentCategories.title")}</FieldLabel>
        <FieldDescription>{t("projectAdmin:agentCategories.description")}</FieldDescription>

        <div className="flex flex-wrap gap-2 mt-2">
          {categories.map((category) => (
            <Badge key={category.id} variant="secondary" className="gap-1 pr-1 text-sm">
              {category.name}
              <button
                type="button"
                onClick={() => setCategoryToRemove(category)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={t("projectAdmin:agentCategories.removeCategory", {
                  name: category.name,
                })}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("projectAdmin:agentCategories.empty")}
            </p>
          )}
        </div>
      </Field>

      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setIsAddDialogOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        {t("projectAdmin:agentCategories.addCategory")}
      </Button>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projectAdmin:agentCategories.addDialogTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder={t("projectAdmin:agentCategories.categoryNamePlaceholder")}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddCategory()
            }}
            autoFocus
          />
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
            <DialogTitle>{t("projectAdmin:agentCategories.removeDialogTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("projectAdmin:agentCategories.removeDialogDescription", {
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
