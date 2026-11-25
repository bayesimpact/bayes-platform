import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Switch } from "@caseai-connect/ui/shad/switch"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { RotateCcwIcon } from "lucide-react"
import { useMemo } from "react"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import type { ProjectModel } from "../../backoffice.models"

/**
 * The platform models, grouped by vendor as in the Studio's model picker, each turned on or off
 * for one workspace. A model the workspace never
 * set follows the default: the hosted APIs are on, the self-hosted models and the APIs served
 * outside the EU are off.
 */
export function ProjectModelsTable({
  models,
  canUpdate,
  onToggle,
  onReset,
}: {
  models: ProjectModel[]
  canUpdate: boolean
  onToggle: (model: string, enabled: boolean) => void
  onReset: (model: string) => void
}) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a reload.
  "use no memo"
  const columns = useMemo<ColumnDef<ProjectModel>[]>(
    () => [
      {
        accessorKey: "model",
        header: () => "Model",
        meta: { className: "w-full" } satisfies DataTableColumnMeta,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <VendorMark vendor={row.original.vendor} />
            <div className="flex flex-col">
              <span className="font-medium">{row.original.name}</span>
              <span className="text-xs text-muted-foreground">{row.original.model}</span>
            </div>
            {row.original.retirement && <RetirementBadge retirement={row.original.retirement} />}
            {row.original.servedOutsideEu && <Badge variant="warning">Outside the EU</Badge>}
            {row.original.selfHosted && <Badge variant="secondary">Self-hosted</Badge>}
          </div>
        ),
      },
      {
        accessorKey: "vendor",
        header: () => "Vendor",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{row.original.vendor}</span>
        ),
      },
      {
        id: "enabled",
        header: () => "Offered",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Switch
              checked={row.original.enabled}
              disabled={!canUpdate}
              aria-label={`Offer ${row.original.model}`}
              onCheckedChange={(checked) => onToggle(row.original.model, checked)}
            />
            <span className="text-xs text-muted-foreground">
              {row.original.customized ? "Set here" : "Default"}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) =>
          canUpdate && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!row.original.customized}
                onClick={() => onReset(row.original.model)}
              >
                <RotateCcwIcon className="size-4" />
                Default
              </Button>
            </div>
          ),
      },
    ],
    [canUpdate, onToggle, onReset],
  )

  const table = useReactTable({
    data: sortByVendor(models),
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <DataTable
      table={table}
      empty={<p className="text-center text-muted-foreground">No model</p>}
    />
  )
}

/** The first letter of the vendor, as in the Studio's model picker. */
function VendorMark({ vendor }: { vendor: string }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
      {vendor.charAt(0).toUpperCase()}
    </span>
  )
}

/** The models of one vendor together, vendors in the order the platform lists them. */
function sortByVendor(models: ProjectModel[]): ProjectModel[] {
  const vendorOrder = [...new Set(models.map((model) => model.vendor))]
  return [...models].sort(
    (first, second) => vendorOrder.indexOf(first.vendor) - vendorOrder.indexOf(second.vendor),
  )
}

/** When the provider retires the model, past or to come, and the model to move to. */
function RetirementBadge({ retirement }: { retirement: NonNullable<ProjectModel["retirement"]> }) {
  const past = retirement.date < new Date().toISOString().slice(0, 10)
  const date = new Date(retirement.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
  return (
    <Badge variant="warning" title={`Replace with ${retirement.replacement}`}>
      {past ? "Retired" : "Retires"} on {date}
    </Badge>
  )
}
