import { Button } from "@caseai-connect/ui/shad/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@caseai-connect/ui/shad/command"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAppDispatch } from "@/common/store/hooks"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { createDocumentTag } from "@/studio/features/document-tags/document-tags.thunks"

export function DocumentTagPicker({
  documentTags,
  attachedTagIds,
  onAdd,
}: {
  documentTags: DocumentTag[]
  attachedTagIds: string[]
  onAdd: (tagId: string) => void
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const availableTags = documentTags.filter((tag) => !attachedTagIds.includes(tag.id))
  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase()),
  )
  const hasExactMatch = availableTags.some((tag) => tag.name.toLowerCase() === search.toLowerCase())
  const showCreate = search.trim().length > 0 && !hasExactMatch

  const handleSelect = (tagId: string) => {
    onAdd(tagId)
    setOpen(false)
    setSearch("")
  }

  const handleCreate = () => {
    dispatch(
      createDocumentTag({
        fields: { name: search.trim() },
        onSuccess: (newTag) => {
          onAdd(newTag.id)
          setOpen(false)
          setSearch("")
        },
      }),
    )
  }

  const hasFilteredTags = filteredTags.length > 0
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* type="button" prevents submitting the surrounding agent form */}
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <PlusIcon className="size-3" />
          {t("documentTag:addTag")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("documentTag:searchPlaceholder")}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!hasFilteredTags && !showCreate && (
              <CommandEmpty>{t("documentTag:noTagsFound")}</CommandEmpty>
            )}
            {hasFilteredTags && (
              <CommandGroup>
                {filteredTags.map((tag) => (
                  <CommandItem key={tag.id} onSelect={() => handleSelect(tag.id)}>
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <>
                {hasFilteredTags && <CommandSeparator />}
                <CommandGroup>
                  <CommandItem onSelect={handleCreate}>
                    <PlusIcon />
                    {t("actions:add")}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
