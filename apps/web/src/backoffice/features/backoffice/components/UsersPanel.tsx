import { Badge } from "@caseai-connect/ui/shad/badge"
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
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeUser } from "../backoffice.models"
import { selectBackofficeUsers, selectBackofficeUsersQuery } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"

const DEFAULT_PAGE_SIZE = 10

type UserRow = {
  id: string
  email: string
  name: string
  organizationMemberships: BackofficeUser["organizationMemberships"]
  projectMemberships: BackofficeUser["projectMemberships"]
}

export function UsersPanel() {
  const users = useAppSelector(selectBackofficeUsers)
  return (
    <AsyncRoute data={[users]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const users = useValue(selectBackofficeUsers)
  const dispatch = useAppDispatch()
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

  const rows = useMemo<UserRow[]>(
    () =>
      users.users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name ?? "",
        organizationMemberships: user.organizationMemberships,
        projectMemberships: user.projectMemberships,
      })),
    [users.users],
  )

  const columns = useMemo<ColumnDef<UserRow>[]>(
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
      {
        id: "organizations",
        header: () => <span className="text-muted-foreground">Organizations</span>,
        cell: ({ row }) => (
          <MembershipsCell
            items={row.original.organizationMemberships.map((membership) => ({
              key: membership.organizationId,
              name: membership.organizationName,
              role: membership.role,
            }))}
          />
        ),
      },
      {
        id: "projects",
        header: () => <span className="text-muted-foreground">Projects</span>,
        cell: ({ row }) => (
          <MembershipsCell
            items={row.original.projectMemberships.map((membership) => ({
              key: membership.projectId,
              name: membership.projectName,
              role: membership.role,
            }))}
          />
        ),
      },
    ],
    [],
  )

  const pageSize = users.limit || DEFAULT_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(users.total / pageSize))

  const table = useReactTable({
    data: rows,
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
          placeholder="Search users, organizations, projects, or agents…"
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

function MembershipsCell({ items }: { items: { key: string; name: string; role: string }[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground italic">—</span>
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <Badge key={item.key} variant="secondary" className="gap-1">
          <span className="font-medium">{item.name}</span>
          <span className="text-xs text-muted-foreground">({item.role})</span>
        </Badge>
      ))}
    </div>
  )
}
