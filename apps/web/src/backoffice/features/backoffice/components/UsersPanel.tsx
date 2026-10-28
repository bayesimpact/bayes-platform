import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BackofficeUserRoutes } from "@/backoffice/routes/helpers"
import { DataTable } from "@/common/components/data-table/DataTable"
import { DEFAULT_PAGE_SIZE, PaginationControls } from "@/common/components/shared/RecordTableParts"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type { BackofficeUser } from "../backoffice.models"
import { selectBackofficeUsers, selectBackofficeUsersQuery } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"
import { SearchField } from "./BackofficeTable"
import { RolePermissionBadge } from "./RolePermissionBadge"

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
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a search or a page change.
  "use no memo"
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
        header: () => "User",
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
        id: "globalRoles",
        header: () => "Global roles",
        cell: ({ row }) =>
          row.original.globalRoles.length === 0 ? null : (
            <div className="flex flex-wrap gap-1.5">
              {row.original.globalRoles.map((globalRole) => (
                <RolePermissionBadge
                  key={globalRole.key}
                  role={globalRole.name}
                  roleKey={globalRole.key}
                />
              ))}
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

  return (
    <>
      <div className="p-4 border-b">
        <SearchField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by email, name or UUID…"
        />
      </div>
      <div className="p-4">
        <DataTable
          table={table}
          onRowClick={(user) => navigate(BackofficeUserRoutes.user.build({ userId: user.id }))}
          empty={<p className="py-8 text-center text-muted-foreground">No results</p>}
        />
        {users.total > 0 && (
          <PaginationControls
            pageIndex={users.page}
            pageCount={pageCount}
            total={users.total}
            onPageChange={goToPage}
          />
        )}
      </div>
    </>
  )
}
