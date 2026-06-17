import { type FeatureFlagKey, FeatureFlags } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { Input } from "@caseai-connect/ui/shad/input"
import type { Column } from "@tanstack/react-table"
import { ArrowUpDownIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
import { useMemo } from "react"

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
  enabledFlags,
  onAdd,
  onRemove,
}: {
  enabledFlags: FeatureFlagKey[]
  onAdd: (featureFlagKey: FeatureFlagKey) => void
  onRemove: (featureFlagKey: FeatureFlagKey) => void
}) {
  const availableFlags = useMemo(
    () => FeatureFlags.filter((flag) => !enabledFlags.includes(flag.key)),
    [enabledFlags],
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      {enabledFlags.map((flagKey) => (
        <Badge key={flagKey} variant="secondary" className="gap-1 pr-1">
          {flagKey}
          <button
            type="button"
            onClick={() => onRemove(flagKey)}
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Remove ${flagKey}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {availableFlags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              <PlusIcon className="mr-1 h-3 w-3" />
              Add flag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {availableFlags.map((flag) => (
              <DropdownMenuItem key={flag.key} onSelect={() => onAdd(flag.key)}>
                <div className="flex flex-col">
                  <span className="font-medium">{flag.key}</span>
                  <span className="text-xs text-muted-foreground">{flag.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
