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
import { BackofficeAgentRoutes } from "@/backoffice/routes/helpers"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeAgentListItem } from "../backoffice.models"
import { selectBackofficeAgents, selectBackofficeAgentsQuery } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"

const DEFAULT_PAGE_SIZE = 10

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
        header: () => <span className="text-muted-foreground">Agent</span>,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "projectName",
        header: () => <span className="text-muted-foreground">Project</span>,
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

  const from = agents.total === 0 ? 0 : agents.page * pageSize + 1
  const to = Math.min((agents.page + 1) * pageSize, agents.total)

  return (
    <>
      <div className="p-4 border-b">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name or UUID…"
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
                onClick={() => handleRowClick(row.original.id)}
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
          {agents.total === 0 ? "No agents" : `${from}–${to} of ${agents.total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={agents.page <= 0}
            onClick={() => goToPage(agents.page - 1)}
          >
            <ChevronLeftIcon className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {agents.page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={agents.page >= pageCount - 1}
            onClick={() => goToPage(agents.page + 1)}
          >
            Next
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
