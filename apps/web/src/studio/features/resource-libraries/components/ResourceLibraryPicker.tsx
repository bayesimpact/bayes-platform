import { Button } from "@caseai-connect/ui/shad/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@caseai-connect/ui/shad/command"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { PlusIcon } from "lucide-react"
import { useState } from "react"
import type { ResourceLibrary } from "../resource-libraries.models"

export function ResourceLibraryPicker({
  resourceLibraries,
  attachedLibraryIds,
  onAdd,
}: {
  resourceLibraries: ResourceLibrary[]
  attachedLibraryIds: string[]
  onAdd: (resourceLibraryId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const availableLibraries = resourceLibraries.filter(
    (library) => !attachedLibraryIds.includes(library.id),
  )
  const filteredLibraries = availableLibraries.filter((library) =>
    library.title.toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelect = (resourceLibraryId: string) => {
    onAdd(resourceLibraryId)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1">
          <PlusIcon className="size-3" />
          Add library
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search libraries..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filteredLibraries.length === 0 && <CommandEmpty>No libraries found</CommandEmpty>}
            {filteredLibraries.length > 0 && (
              <CommandGroup>
                {filteredLibraries.map((library) => (
                  <CommandItem key={library.id} onSelect={() => handleSelect(library.id)}>
                    {library.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
