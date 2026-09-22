import {
  APP_GRANTABLE_PERMISSIONS,
  type AppGrantablePermission,
  createAppManifestSchema,
} from "@caseai-connect/api-contracts"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@caseai-connect/ui/shad/form"
import { Input } from "@caseai-connect/ui/shad/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { AppManifest } from "../backoffice.models"
import { selectAppManifests } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"

type ManifestFormValues = z.input<typeof createAppManifestSchema>
type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; manifest: AppManifest }
  | { kind: "delete"; manifest: AppManifest }

const GRANTABLE_PERMISSION_LABELS: Record<AppGrantablePermission, string> = {
  "document.read": "Read documents",
  "document.create": "Create documents",
  "document.update": "Update documents",
  "document.delete": "Delete documents",
}

const emptyFormValues: ManifestFormValues = {
  name: "",
  slug: "",
  description: "",
  logoUrl: "",
  grantablePermissions: [],
}

export function AppsPanel() {
  const appManifests = useAppSelector(selectAppManifests)

  useMount({
    actions: {
      mount: backofficeActions.appsPanelMount,
      unmount: backofficeActions.appsPanelUnmount,
    },
  })

  return (
    <AsyncRoute data={[appManifests]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const manifests = useValue(selectAppManifests)
  const [searchInput, setSearchInput] = useState("")
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })

  const filteredManifests = useMemo(() => {
    const query = searchInput.trim().toLowerCase()
    if (!query) return manifests
    return manifests.filter((manifest) => {
      const haystack = [manifest.name, manifest.slug, manifest.description ?? ""]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [manifests, searchInput])

  const columns = useMemo<ColumnDef<AppManifest>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => <span className="text-muted-foreground">App</span>,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.slug}</span>
          </div>
        ),
      },
      {
        accessorKey: "grantablePermissions",
        header: () => <span className="text-muted-foreground">Grantable permissions</span>,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.grantablePermissions.length === 0
              ? "None"
              : row.original.grantablePermissions.join(", ")}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setDialog({ kind: "edit", manifest: row.original })}
              aria-label={`Edit ${row.original.name}`}
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => setDialog({ kind: "delete", manifest: row.original })}
              aria-label={`Delete ${row.original.name}`}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: filteredManifests,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <div className="flex-1">
          <SearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by name or slug…"
          />
        </div>
        <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
          <PlusIcon className="size-4" />
          Create app
        </Button>
      </div>
      <Table>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                No apps yet
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {(dialog.kind === "create" || dialog.kind === "edit") && (
        <AppManifestFormDialog
          key={dialog.kind === "edit" ? dialog.manifest.id : "create"}
          manifest={dialog.kind === "edit" ? dialog.manifest : null}
          onClose={() => setDialog({ kind: "closed" })}
        />
      )}
      {dialog.kind === "delete" && (
        <DeleteAppManifestDialog
          manifest={dialog.manifest}
          onClose={() => setDialog({ kind: "closed" })}
        />
      )}
    </>
  )
}

function AppManifestFormDialog({
  manifest,
  onClose,
}: {
  manifest: AppManifest | null
  onClose: () => void
}) {
  const dispatch = useAppDispatch()
  const form = useForm<ManifestFormValues>({
    resolver: zodResolver(createAppManifestSchema),
    defaultValues: manifest
      ? {
          name: manifest.name,
          slug: manifest.slug,
          description: manifest.description ?? "",
          logoUrl: manifest.logoUrl ?? "",
          grantablePermissions: manifest.grantablePermissions,
        }
      : emptyFormValues,
  })

  const onValid = async (values: ManifestFormValues) => {
    const parsed = createAppManifestSchema.parse(values)
    try {
      if (manifest) {
        await dispatch(
          backofficeActions.updateAppManifest({
            appManifestId: manifest.id,
            input: parsed,
          }),
        ).unwrap()
      } else {
        await dispatch(backofficeActions.createAppManifest(parsed)).unwrap()
      }
      onClose()
    } catch {
      // The middleware shows the error notification; keep the dialog open for a retry.
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{manifest ? "Edit app" : "Create app"}</DialogTitle>
          <DialogDescription>
            Grantable permissions are the maximum an installation of this app may receive.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onValid)} className="flex flex-col gap-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Helpful Assistant" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input placeholder="helpful-assistant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What this app does"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/logo.png"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="grantablePermissions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grantable permissions</FormLabel>
                  <div className="flex flex-col gap-2">
                    {APP_GRANTABLE_PERMISSIONS.map((permission) => {
                      const checkboxId = `grantable-${permission}`
                      return (
                        <div key={permission} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={checkboxId}
                            checked={field.value.includes(permission)}
                            onCheckedChange={(checked) => {
                              field.onChange(
                                checked === true
                                  ? [...field.value, permission]
                                  : field.value.filter(
                                      (selectedPermission) => selectedPermission !== permission,
                                    ),
                              )
                            }}
                          />
                          <label htmlFor={checkboxId} className="cursor-pointer">
                            {GRANTABLE_PERMISSION_LABELS[permission]}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {manifest ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAppManifestDialog({
  manifest,
  onClose,
}: {
  manifest: AppManifest
  onClose: () => void
}) {
  const dispatch = useAppDispatch()

  const onConfirm = async () => {
    try {
      await dispatch(backofficeActions.deleteAppManifest(manifest.id)).unwrap()
      onClose()
    } catch {
      // The middleware shows the error notification; keep the dialog open for a retry.
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {manifest.name}?</DialogTitle>
          <DialogDescription>
            This cannot be undone. Delete is refused while the app still has active installations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
