import { Button } from "@caseai-connect/ui/shad/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BackofficeProjectRoutes } from "@/backoffice/routes/helpers"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeProjectListItem } from "../backoffice.models"
import { selectBackofficeProjects, selectBackofficeProjectsQuery } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { FeatureFlagCell, SearchField } from "./BackofficeTable"

const DEFAULT_PAGE_SIZE = 10

export function ProjectsPanel() {
  const dispatch = useAppDispatch()
  const projects = useAppSelector(selectBackofficeProjects)

  useEffect(() => {
    dispatch(backofficeActions.listProjects({ page: 0, limit: 10 }))
  }, [dispatch])

  return (
    <AsyncRoute data={[projects]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const projects = useValue(selectBackofficeProjects)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const query = useAppSelector(selectBackofficeProjectsQuery)
  const [searchInput, setSearchInput] = useState(query.search)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchInput === query.search) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      dispatch(
        backofficeActions.listProjects({
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

  const columns = useMemo<ColumnDef<BackofficeProjectListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => <span className="text-muted-foreground">Project</span>,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "organizationName",
        header: () => <span className="text-muted-foreground">Organization</span>,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.organizationName}</span>
        ),
      },
      {
        id: "featureFlags",
        header: () => <span className="text-muted-foreground">Feature flags</span>,
        cell: ({ row }) => (
          <FeatureFlagCell
            enabledFlags={row.original.featureFlags}
            onAdd={(featureFlagKey) =>
              dispatch(
                backofficeActions.addFeatureFlag({
                  projectId: row.original.id,
                  featureFlagKey,
                }),
              )
            }
            onRemove={(featureFlagKey) =>
              dispatch(
                backofficeActions.removeFeatureFlag({
                  projectId: row.original.id,
                  featureFlagKey,
                }),
              )
            }
          />
        ),
      },
    ],
    [dispatch],
  )

  const pageSize = projects.limit || DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(projects.total / pageSize))

  const table = useReactTable({
    data: projects.projects,
    columns,
    manualPagination: true,
    pageCount,
    rowCount: projects.total,
    getCoreRowModel: getCoreRowModel(),
  })

  const goToPage = (nextPage: number) => {
    dispatch(
      backofficeActions.listProjects({
        page: nextPage,
        limit: pageSize,
        search: query.search,
      }),
    )
  }

  const handleRowClick = (event: React.MouseEvent, projectId: string) => {
    if ((event.target as HTMLElement).closest("[data-no-navigate]")) return
    navigate(BackofficeProjectRoutes.project.build({ projectId }))
  }

  const from = projects.total === 0 ? 0 : projects.page * pageSize + 1
  const to = Math.min((projects.page + 1) * pageSize, projects.total)

  return (
    <>
      <div className="p-4 border-b">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by project or organization name…"
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
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={(event) => handleRowClick(event, row.original.id)}
              >
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
          {projects.total === 0 ? "No projects" : `${from}–${to} of ${projects.total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={projects.page <= 0}
            onClick={() => goToPage(projects.page - 1)}
          >
            <ChevronLeftIcon className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {projects.page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={projects.page >= pageCount - 1}
            onClick={() => goToPage(projects.page + 1)}
          >
            Next
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
