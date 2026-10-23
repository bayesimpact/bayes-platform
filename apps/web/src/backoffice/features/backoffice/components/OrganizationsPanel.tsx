import { createBackofficeOrganizationSchema } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
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
import { zodResolver } from "@hookform/resolvers/zod"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { PlusIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import type { z } from "zod"
import { BackofficeOrganizationRoutes } from "@/backoffice/routes/helpers"
import { DataTable } from "@/common/components/data-table/DataTable"
import { DEFAULT_PAGE_SIZE, PaginationControls } from "@/common/components/shared/RecordTableParts"
import { selectCanCreateOrganization } from "@/common/features/me/me.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeOrganization } from "../backoffice.models"
import {
  selectBackofficeOrganizations,
  selectBackofficeOrganizationsQuery,
} from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"

type CreateOrganizationFormValues = z.infer<typeof createBackofficeOrganizationSchema>

export function OrganizationsPanel() {
  const organizations = useAppSelector(selectBackofficeOrganizations)

  useMount({
    actions: {
      mount: backofficeActions.organizationsPanelMount,
      unmount: backofficeActions.organizationsPanelUnmount,
    },
  })

  return (
    <AsyncRoute data={[organizations]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a search or a page change.
  "use no memo"
  const organizations = useValue(selectBackofficeOrganizations)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const query = useAppSelector(selectBackofficeOrganizationsQuery)
  const canCreateOrganization = useAppSelector(selectCanCreateOrganization)
  const [searchInput, setSearchInput] = useState(query.search)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchInput === query.search) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      dispatch(
        backofficeActions.listOrganizations({
          page: 0,
          limit: query.limit,
          search: searchInput,
        }),
      )
    }, 300)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [searchInput, query.search, query.limit, dispatch])

  const columns = useMemo<ColumnDef<BackofficeOrganization>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => "Organization",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
    ],
    [],
  )

  const pageSize = organizations.limit || DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(organizations.total / pageSize))

  const table = useReactTable({
    data: organizations.organizations,
    columns,
    manualPagination: true,
    pageCount,
    rowCount: organizations.total,
    getCoreRowModel: getCoreRowModel(),
  })

  const goToPage = (nextPage: number) => {
    dispatch(
      backofficeActions.listOrganizations({
        page: nextPage,
        limit: pageSize,
        search: query.search,
      }),
    )
  }

  const handleRowClick = (organizationId: string) => {
    navigate(BackofficeOrganizationRoutes.organization.build({ organizationId }))
  }

  return (
    <>
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <div className="flex-1">
          <SearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by name or UUID…"
          />
        </div>
        {canCreateOrganization && <CreateOrganizationDialog />}
      </div>
      <div className="p-4">
        <DataTable
          table={table}
          onRowClick={(organization) => handleRowClick(organization.id)}
          empty={<p className="py-8 text-center text-muted-foreground">No results</p>}
        />
        {organizations.total > 0 && (
          <PaginationControls
            pageIndex={organizations.page}
            pageCount={pageCount}
            total={organizations.total}
            onPageChange={goToPage}
          />
        )}
      </div>
    </>
  )
}

function CreateOrganizationDialog() {
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)

  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createBackofficeOrganizationSchema),
    defaultValues: { name: "" },
  })

  const close = () => {
    setOpen(false)
    form.reset({ name: "" })
  }

  const onValid = async ({ name }: CreateOrganizationFormValues) => {
    try {
      await dispatch(backofficeActions.createOrganization({ name })).unwrap()
      close()
    } catch {
      // The middleware shows the error notification; keep the dialog open for a retry.
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Create organization
      </Button>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onValid)} className="flex flex-col gap-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Organization name" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
