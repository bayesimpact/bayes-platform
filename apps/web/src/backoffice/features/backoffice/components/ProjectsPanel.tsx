import { BACKOFFICE_PROJECT_UPDATE_PERMISSION } from "@caseai-connect/api-contracts"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BackofficeProjectRoutes } from "@/backoffice/routes/helpers"
import { DataTable } from "@/common/components/data-table/DataTable"
import { DEFAULT_PAGE_SIZE, PaginationControls } from "@/common/components/shared/RecordTableParts"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeProjectListItem } from "../backoffice.models"
import { selectBackofficeProjects, selectBackofficeProjectsQuery } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { FeatureFlagCell, SearchField } from "./BackofficeTable"

export function ProjectsPanel() {
  const projects = useAppSelector(selectBackofficeProjects)

  useMount({
    actions: {
      mount: backofficeActions.projectsPanelMount,
      unmount: backofficeActions.projectsPanelUnmount,
    },
  })

  return (
    <AsyncRoute data={[projects]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a search or a page change.
  "use no memo"
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
        header: () => "Project",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "organizationName",
        header: () => "Organization",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.organizationName}</span>
        ),
      },
      {
        id: "featureFlags",
        header: () => "Feature flags",
        cell: ({ row }) => (
          // The row opens the project on click: the flags button and its dialog (portaled, but
          // inside this React tree) must not.
          // biome-ignore lint/a11y/noStaticElementInteractions: only stops the click from reaching the row
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard events never reach the row
          <div onClick={(event) => event.stopPropagation()}>
            <FeatureFlagCell
              projectName={row.original.name}
              enabledFlags={row.original.featureFlags}
              canUpdate={row.original.permissions.includes(BACKOFFICE_PROJECT_UPDATE_PERMISSION)}
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
          </div>
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

  return (
    <>
      <div className="p-4 border-b">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name or UUID…"
        />
      </div>
      <div className="p-4">
        <DataTable
          table={table}
          onRowClick={(project) =>
            navigate(BackofficeProjectRoutes.project.build({ projectId: project.id }))
          }
          empty={<p className="py-8 text-center text-muted-foreground">No results</p>}
        />
        {projects.total > 0 && (
          <PaginationControls
            pageIndex={projects.page}
            pageCount={pageCount}
            total={projects.total}
            onPageChange={goToPage}
          />
        )}
      </div>
    </>
  )
}
