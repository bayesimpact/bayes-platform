import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BackofficeAgentRoutes } from "@/backoffice/routes/helpers"
import { DataTable } from "@/common/components/data-table/DataTable"
import { DEFAULT_PAGE_SIZE, PaginationControls } from "@/common/components/shared/RecordTableParts"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeAgentListItem } from "../backoffice.models"
import { selectBackofficeAgents, selectBackofficeAgentsQuery } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"

export function AgentsPanel() {
  const agents = useAppSelector(selectBackofficeAgents)

  useMount({
    actions: {
      mount: backofficeActions.agentsPanelMount,
      unmount: backofficeActions.agentsPanelUnmount,
    },
  })

  return (
    <AsyncRoute data={[agents]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a search or a page change.
  "use no memo"
  const agents = useValue(selectBackofficeAgents)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const query = useAppSelector(selectBackofficeAgentsQuery)
  const [searchInput, setSearchInput] = useState(query.search)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchInput === query.search) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      dispatch(
        backofficeActions.listAgents({
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

  const columns = useMemo<ColumnDef<BackofficeAgentListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => "Agent",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "projectName",
        header: () => "Project",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.projectName}</span>
        ),
      },
    ],
    [],
  )

  const pageSize = agents.limit || DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(agents.total / pageSize))

  const table = useReactTable({
    data: agents.agents,
    columns,
    manualPagination: true,
    pageCount,
    rowCount: agents.total,
    getCoreRowModel: getCoreRowModel(),
  })

  const goToPage = (nextPage: number) => {
    dispatch(
      backofficeActions.listAgents({
        page: nextPage,
        limit: pageSize,
        search: query.search,
      }),
    )
  }

  const handleRowClick = (agentId: string) => {
    navigate(BackofficeAgentRoutes.agent.build({ agentId }))
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
          onRowClick={(agent) => handleRowClick(agent.id)}
          empty={<p className="py-8 text-center text-muted-foreground">No results</p>}
        />
        {agents.total > 0 && (
          <PaginationControls
            pageIndex={agents.page}
            pageCount={pageCount}
            total={agents.total}
            onPageChange={goToPage}
          />
        )}
      </div>
    </>
  )
}
