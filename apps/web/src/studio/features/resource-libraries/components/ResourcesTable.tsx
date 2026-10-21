import { Button } from "@caseai-connect/ui/shad/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@caseai-connect/ui/shad/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { EyeIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { ResourceCard } from "@/common/components/resources/ResourceCard"
import { buildResourceLink } from "../resource-libraries.helpers"
import type { Resource } from "../resource-libraries.models"

function resourceLinkLabel(resource: Resource, fallback: string): string {
  if (resource.linkType === "url") return resource.url ?? ""
  return resource.file?.fileName ?? fallback
}

export function ResourcesTable({
  resources,
  organizationId,
  projectId,
  resourceLibraryId,
  onEdit,
  onDelete,
}: {
  resources: Resource[]
  organizationId: string
  projectId: string
  resourceLibraryId: string | null
  onEdit: (resource: Resource) => void
  onDelete: (resource: Resource) => void
}) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows.
  "use no memo"
  const { t } = useTranslation()
  const [previewResource, setPreviewResource] = useState<Resource | null>(null)

  const columns = useMemo<ColumnDef<Resource>[]>(
    () => [
      {
        accessorKey: "title",
        header: () => t("resourceLibrary:table.title"),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        accessorKey: "description",
        header: () => t("resourceLibrary:table.description"),
        cell: ({ row }) => {
          const { description } = row.original
          if (!description) return <span className="text-muted-foreground">—</span>
          return (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="block max-w-xs truncate text-left hover:underline">
                  {description}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 whitespace-pre-wrap text-sm">
                {description}
              </PopoverContent>
            </Popover>
          )
        },
      },
      {
        id: "link",
        header: () => t("resourceLibrary:table.link"),
        cell: ({ row }) => {
          const label = resourceLinkLabel(row.original, t("resourceLibrary:link.file"))
          if (!label) return <span className="text-muted-foreground">—</span>
          return (
            <span className="block max-w-[16rem] truncate text-muted-foreground" title={label}>
              {label}
            </span>
          )
        },
      },
      {
        id: "actions",
        meta: { className: "w-10" } satisfies DataTableColumnMeta,
        header: () => <span className="sr-only">{t("resourceLibrary:table.actions")}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t("resourceLibrary:table.actions")}
                >
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setPreviewResource(row.original)}>
                  <EyeIcon className="size-4" />
                  {t("actions:preview")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(row.original)}>
                  <PencilIcon className="size-4" />
                  {t("actions:edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row.original)}>
                  <Trash2Icon className="size-4" />
                  {t("actions:delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [t, onEdit, onDelete],
  )

  const table = useReactTable({
    data: resources,
    columns,
    getRowId: (resource) => resource.id,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <DataTable table={table} empty={t("resourceLibrary:form.noResources")} />

      <Dialog
        open={previewResource !== null}
        onOpenChange={(open) => !open && setPreviewResource(null)}
      >
        <DialogContent className="w-fit max-w-none">
          <DialogHeader>
            <DialogTitle>{t("resourceLibrary:preview.title")}</DialogTitle>
          </DialogHeader>
          {previewResource && (
            <ResourceCard
              resource={{
                title: previewResource.title,
                description: previewResource.description,
                link: buildResourceLink({
                  resource: previewResource,
                  organizationId,
                  projectId,
                  resourceLibraryId,
                }),
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
