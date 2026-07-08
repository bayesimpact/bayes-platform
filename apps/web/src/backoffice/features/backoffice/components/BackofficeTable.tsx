import { type FeatureFlagKey, FeatureFlags } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@caseai-connect/ui/shad/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@caseai-connect/ui/shad/dialog"
import { Input } from "@caseai-connect/ui/shad/input"
import type { Column } from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  ChevronsUpDownIcon,
  FlagIcon,
  MinusCircleIcon,
  PlusCircleIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { type ReactNode, useState } from "react"

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative max-w-sm">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        className="pl-8"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="search"
      />
    </div>
  )
}

export function FeatureFlagCell({
  projectName,
  enabledFlags,
  onAdd,
  onRemove,
}: {
  projectName: string
  enabledFlags: FeatureFlagKey[]
  onAdd: (featureFlagKey: FeatureFlagKey) => void
  onRemove: (featureFlagKey: FeatureFlagKey) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const enabledCount = enabledFlags.length

  const normalizedSearch = search.trim().toLowerCase()
  const visibleFlags = [...FeatureFlags]
    .filter(
      (flag) =>
        flag.key.toLowerCase().includes(normalizedSearch) ||
        flag.description.toLowerCase().includes(normalizedSearch),
    )
    .sort((flagA, flagB) => flagA.key.localeCompare(flagB.key))
  const availableFlags = visibleFlags.filter((flag) => !enabledFlags.includes(flag.key))
  const selectedFlags = visibleFlags.filter((flag) => enabledFlags.includes(flag.key))

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setSearch("")
  }

  const handleAdd = (flagKey: FeatureFlagKey) => {
    onAdd(flagKey)
    setSearch("")
  }

  const handleRemove = (flagKey: FeatureFlagKey) => {
    onRemove(flagKey)
    setSearch("")
  }

  return (
    <div data-no-navigate>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 justify-between gap-2 font-normal"
          >
            <span className="flex items-center gap-1.5">
              <FlagIcon className="size-3.5 text-muted-foreground" />
              {enabledCount === 0 ? (
                <span className="text-muted-foreground">No flags</span>
              ) : (
                <span>
                  {enabledCount} {enabledCount === 1 ? "flag" : "flags"}
                </span>
              )}
            </span>
            <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
          </Button>
        </DialogTrigger>
        <DialogContent
          className="gap-0 p-0 sm:max-w-3xl"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>
              <span className="font-normal text-muted-foreground">{projectName} / </span>
              Feature flags
            </DialogTitle>
            <DialogDescription>Enable or disable feature flags for this project.</DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false}>
            <div className="relative border-t">
              <CommandInput
                placeholder="Search flags…"
                value={search}
                onValueChange={setSearch}
                className="pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 divide-x">
              <FlagColumn
                heading={`Available · ${availableFlags.length}`}
                icon={<PlusCircleIcon className="size-4 shrink-0 text-green-500 mt-1 mx-1" />}
                flags={availableFlags}
                emptyLabel={normalizedSearch ? "No matches" : "All flags enabled"}
                onSelect={handleAdd}
              />
              <FlagColumn
                heading={`Enabled · ${selectedFlags.length}`}
                icon={<MinusCircleIcon className="size-4 shrink-0 text-red-500 mt-1 mx-1" />}
                flags={selectedFlags}
                emptyLabel={normalizedSearch ? "No matches" : "No flags enabled"}
                onSelect={handleRemove}
              />
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type FeatureFlag = (typeof FeatureFlags)[number]

function FlagColumn({
  heading,
  icon,
  flags,
  emptyLabel,
  onSelect,
}: {
  heading: string
  icon: ReactNode
  flags: FeatureFlag[]
  emptyLabel: string
  onSelect: (featureFlagKey: FeatureFlagKey) => void
}) {
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3 pb-1 text-sm font-semibold text-foreground">{heading}</div>
      <CommandList className="max-h-[28rem] min-h-72">
        {flags.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyLabel}</p>
        ) : (
          <CommandGroup>
            {flags.map((flag) => (
              <CommandItem
                key={flag.key}
                value={flag.key}
                onSelect={() => onSelect(flag.key)}
                className="items-start cursor-pointer"
              >
                {icon}
                <div className="flex flex-col">
                  <span className="font-medium capitalize">{flag.key}</span>
                  <span className="text-xs text-muted-foreground">{flag.description}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </div>
  )
}

export function SortableHeader<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>
  label: string
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => {
        column.toggleSorting()
      }}
    >
      {label}
      <ArrowUpDownIcon className="size-3.5" />
    </button>
  )
}
