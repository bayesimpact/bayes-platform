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
import { BackofficeUserRoutes } from "@/backoffice/routes/helpers"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeUser } from "../backoffice.models"
import { selectBackofficeUsers, selectBackofficeUsersQuery } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"

const DEFAULT_PAGE_SIZE = 10

export function UsersPanel() {
  const users = useAppSelector(selectBackofficeUsers)

  useMount({
    actions: {
      mount: backofficeActions.usersPanelMount,
      unmount: backofficeActions.usersPanelUnmount,
    },
  })

  return (
    <AsyncRoute data={[users]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const users = useValue(selectBackofficeUsers)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const query = useAppSelector(selectBackofficeUsersQuery)
  const [searchInput, setSearchInput] = useState(query.search)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchInput === query.search) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      dispatch(
        backofficeActions.listUsers({
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

  const columns = useMemo<ColumnDef<BackofficeUser>[]>(
    () => [
      {
        accessorKey: "email",
        header: () => <span className="text-muted-foreground">User</span>,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.email}</span>
            {row.original.name && (
              <span className="text-xs text-muted-foreground">{row.original.name}</span>
            )}
          </div>
        ),
      },
    ],
    [],
  )

  const pageSize = users.limit || DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(users.total / pageSize))

  const table = useReactTable({
    data: users.users,
    columns,
    manualPagination: true,
    pageCount,
    rowCount: users.total,
    getCoreRowModel: getCoreRowModel(),
  })

  const goToPage = (nextPage: number) => {
    dispatch(
      backofficeActions.listUsers({
        page: nextPage,
        limit: pageSize,
        search: query.search,
      }),
    )
  }

  const from = users.total === 0 ? 0 : users.page * pageSize + 1
  const to = Math.min((users.page + 1) * pageSize, users.total)

  return (
    <>
      <div className="p-4 border-b">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by email, name or UUID…"
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
                onClick={() =>
                  navigate(BackofficeUserRoutes.user.build({ userId: row.original.id }))
                }
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
          {users.total === 0 ? "No users" : `${from}–${to} of ${users.total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={users.page <= 0}
            onClick={() => goToPage(users.page - 1)}
          >
            <ChevronLeftIcon className="size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {users.page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={users.page >= pageCount - 1}
            onClick={() => goToPage(users.page + 1)}
          >
            Next
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
