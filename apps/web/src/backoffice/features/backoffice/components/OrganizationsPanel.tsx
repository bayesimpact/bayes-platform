import { type FeatureFlagKey, FeatureFlags } from "@caseai-connect/api-contracts"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  selectBackofficeOrganizations,
  selectBackofficeOrganizationsQuery,
} from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"

const DEFAULT_PAGE_SIZE = 10

type OrganizationRow = {
  organizationId: string
  organizationName: string
  projectId: string | null
  projectName: string
  featureFlags: FeatureFlagKey[]
}

export function OrganizationsPanel() {
  const organizations = useAppSelector(selectBackofficeOrganizations)
  return (
    <AsyncRoute data={[organizations]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const organizations = useValue(selectBackofficeOrganizations)
  const dispatch = useAppDispatch()
  const query = useAppSelector(selectBackofficeOrganizationsQuery)
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

  const rows = useMemo<OrganizationRow[]>(
    () =>
      organizations.organizations.flatMap((organization): OrganizationRow[] => {
        if (organization.projects.length === 0) {
          return [
            {
              organizationId: organization.id,
              organizationName: organization.name,
              projectId: null,
              projectName: "",
              featureFlags: [],
            },
          ]
        }
        return organization.projects.map((project) => ({
          organizationId: organization.id,
          organizationName: organization.name,
          projectId: project.id,
          projectName: project.name,
          featureFlags: project.featureFlags as FeatureFlagKey[],
        }))
      }),
    [organizations.organizations],
  )

  const columns = useMemo<ColumnDef<OrganizationRow>[]>(
    () => [
      {
        accessorKey: "organizationName",
        header: () => <span className="text-muted-foreground">Organization</span>,
        cell: ({ row }) => <span className="font-medium">{row.original.organizationName}</span>,
      },
      {
        accessorKey: "projectName",
        header: () => <span className="text-muted-foreground">Project</span>,
        cell: ({ row }) =>
          row.original.projectId ? (
            row.original.projectName
          ) : (
            <span className="text-muted-foreground italic">No projects</span>
          ),
      },
      {
        id: "featureFlags",
        header: () => <span className="text-muted-foreground">Feature flags</span>,
        cell: ({ row }) => {
          const { projectId, featureFlags } = row.original
          if (!projectId) return null
          return (
            <FeatureFlagCell
              enabledFlags={featureFlags}
              onAdd={(featureFlagKey) =>
                dispatch(backofficeActions.addFeatureFlag({ projectId, featureFlagKey }))
              }
              onRemove={(featureFlagKey) =>
                dispatch(backofficeActions.removeFeatureFlag({ projectId, featureFlagKey }))
              }
            />
          )
        },
      },
    ],
    [dispatch],
  )

  const pageSize = organizations.limit || DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(organizations.total / pageSize))

  const table = useReactTable({
    data: rows,
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

  const from = organizations.total === 0 ? 0 : organizations.page * pageSize + 1
  const to = Math.min((organizations.page + 1) * pageSize, organizations.total)

  return (
    <>
      <div className="p-4 border-b">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search organizations or projects…"
        />
      </div>
      <Table>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No results
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between p-4 border-t">
        <span className="text-sm text-muted-foreground">
          {organizations.total === 0
            ? "No organizations"
            : `${from}–${to} of ${organizations.total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={organizations.page <= 0}
            onClick={() => goToPage(organizations.page - 1)}
          >
            <ChevronLeftIcon className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {organizations.page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={organizations.page >= pageCount - 1}
            onClick={() => goToPage(organizations.page + 1)}
          >
            Next
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </>
  )
}

function FeatureFlagCell({
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
