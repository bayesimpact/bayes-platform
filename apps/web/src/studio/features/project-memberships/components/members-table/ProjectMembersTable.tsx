import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@caseai-connect/ui/shad/empty"
import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronRightIcon } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { buildSelectionColumn } from "@/common/components/data-table/selection-column"
import { NeverSignedInBadge } from "@/common/components/NeverSignedInBadge"
import {
  DEFAULT_PAGE_SIZE,
  PaginationControls,
  SortableFilterableHeader,
} from "@/common/components/shared/RecordTableParts"
import { buildSince } from "@/common/utils/build-date"
import { AddRolesDialog } from "./AddRolesDialog"
import { MembersBulkActionBar } from "./MembersBulkActionBar"
import { MembersTableToolbar } from "./MembersTableToolbar"
import {
  type MembersTableMember,
  PROJECT_OWNER_ROLE_KEY,
  type ProjectRoleOption,
} from "./members-table.models"

type PendingAction = "addRoles" | "remove" | null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again."
}

function matchesSearch(member: MembersTableMember, query: string): boolean {
  if (!query) return true
  const name = member.userName?.toLowerCase() ?? ""
  return name.includes(query) || member.userEmail.toLowerCase().includes(query)
}

function isOwner(member: MembersTableMember): boolean {
  return member.roles.some((role) => role.key === PROJECT_OWNER_ROLE_KEY)
}

/**
 * The workspace members, with search, filters and bulk actions. Presentational: the caller
 * passes the members, what the viewer may do, and the handlers that call the API.
 */
export function ProjectMembersTable({
  members,
  roles,
  currentUserId,
  canUpdateRoles,
  canRemoveMembers,
  onAddRoles,
  onRemoveMembers,
  onOpenMember,
  toolbarAction,
}: {
  members: MembersTableMember[]
  /** The roles a member can be given on the workspace (`scope_type = project`). */
  roles: ProjectRoleOption[]
  currentUserId: string
  canUpdateRoles: boolean
  canRemoveMembers: boolean
  /** Rejects with an `Error` whose message is shown in the dialog. */
  onAddRoles: (memberIds: string[], roleKeys: string[]) => Promise<void>
  /** Rejects with an `Error` whose message is shown in the dialog. */
  onRemoveMembers: (memberIds: string[]) => Promise<void>
  onOpenMember: (memberId: string) => void
  toolbarAction?: ReactNode
}) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a search or a filter.
  "use no memo"
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: "member", desc: false }])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const canSelect = canUpdateRoles || canRemoveMembers

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter(
      (member) =>
        matchesSearch(member, query) &&
        (roleFilter.length === 0 || member.roles.some((role) => roleFilter.includes(role.key))),
    )
  }, [members, search, roleFilter])

  const columns = useMemo<ColumnDef<MembersTableMember>[]>(() => {
    const selectColumn = buildSelectionColumn<MembersTableMember>({
      rowLabel: (member) => `Select ${member.userName ?? member.userEmail}`,
    })
    const dataColumns: ColumnDef<MembersTableMember>[] = [
      {
        id: "member",
        accessorFn: (member) => member.userName ?? member.userEmail,
        enableColumnFilter: false,
        header: ({ column }) => <SortableFilterableHeader column={column} label="Member" />,
        cell: ({ row }) => {
          const member = row.original
          return (
            <div className="flex flex-col">
              <span className="flex items-center gap-2 font-medium">
                {member.userName ?? member.userEmail}
                {member.userId === currentUserId && <Badge variant="secondary">You</Badge>}
                {!member.userHasSignedIn && <NeverSignedInBadge />}
              </span>
              {member.userName && (
                <span className="text-sm text-muted-foreground">{member.userEmail}</span>
              )}
            </div>
          )
        },
      },
      {
        id: "roles",
        enableSorting: false,
        header: () => <span className="text-muted-foreground">Roles</span>,
        cell: ({ row }) =>
          row.original.roles.length === 0 ? (
            <span className="text-sm text-muted-foreground">No role</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.roles.map((role) => (
                <Badge
                  key={role.key}
                  variant={role.key === PROJECT_OWNER_ROLE_KEY ? "default" : "outline"}
                >
                  {role.name}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: "joined",
        accessorFn: (member) => member.createdAt,
        enableColumnFilter: false,
        header: ({ column }) => <SortableFilterableHeader column={column} label="Joined" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {buildSince(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "open",
        meta: { className: "w-10" } satisfies DataTableColumnMeta,
        enableSorting: false,
        header: () => null,
        cell: () => <ChevronRightIcon className="size-4 text-muted-foreground" />,
      },
    ]
    return canSelect ? [selectColumn, ...dataColumns] : dataColumns
  }, [canSelect, currentUserId])

  const table = useReactTable({
    data: filteredMembers,
    columns,
    state: { sorting, rowSelection, pagination },
    getRowId: (member) => member.id,
    // Nobody changes their own roles or removes themselves from here.
    enableRowSelection: (row) => canSelect && row.original.userId !== currentUserId,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const selectedMembers = members.filter((member) => rowSelection[member.id])
  const ownerCount = members.filter(isOwner).length
  const removeBlockedReason =
    ownerCount > 0 && selectedMembers.filter(isOwner).length === ownerCount
      ? "A workspace keeps at least one owner. Unselect an owner to remove the others."
      : null

  const resetFilters = () => {
    setSearch("")
    setRoleFilter([])
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }

  const closeDialog = () => {
    setPendingAction(null)
    setActionError(null)
  }

  const runAction = async (action: () => Promise<void>) => {
    setIsConfirming(true)
    setActionError(null)
    try {
      await action()
      setRowSelection({})
      setPendingAction(null)
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setIsConfirming(false)
    }
  }

  const selectedIds = selectedMembers.map((member) => member.id)
  const removeTitle =
    selectedMembers.length === 1
      ? `Remove ${selectedMembers[0]?.userName ?? selectedMembers[0]?.userEmail}?`
      : `Remove ${selectedMembers.length} members?`

  const pageCount = table.getPageCount()

  return (
    <div className="flex flex-col gap-3">
      <MembersTableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPagination((current) => ({ ...current, pageIndex: 0 }))
        }}
        roles={roles}
        roleFilter={roleFilter}
        onRoleFilterChange={(roleKeys) => {
          setRoleFilter(roleKeys)
          setPagination((current) => ({ ...current, pageIndex: 0 }))
        }}
        onClearFilters={resetFilters}
        action={toolbarAction}
      />

      {selectedMembers.length > 0 && (
        <MembersBulkActionBar
          selectedCount={selectedMembers.length}
          canUpdateRoles={canUpdateRoles}
          canRemoveMembers={canRemoveMembers}
          removeBlockedReason={removeBlockedReason}
          onAddRoles={() => setPendingAction("addRoles")}
          onRemove={() => setPendingAction("remove")}
          onClearSelection={() => setRowSelection({})}
        />
      )}

      <DataTable
        table={table}
        onRowClick={(member) => onOpenMember(member.id)}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No member matches</EmptyTitle>
              <EmptyDescription>Try another search or remove a filter.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        }
      />

      {pageCount > 1 && (
        <PaginationControls
          pageIndex={pagination.pageIndex}
          pageCount={pageCount}
          total={filteredMembers.length}
          onPageChange={(pageIndex) => setPagination((current) => ({ ...current, pageIndex }))}
        />
      )}

      {/* Mounted only while open, so each opening starts with no role picked. */}
      {pendingAction === "addRoles" && (
        <AddRolesDialog
          open
          memberCount={selectedMembers.length}
          roles={roles}
          error={actionError}
          isConfirming={isConfirming}
          onCancel={closeDialog}
          onConfirm={(roleKeys) => runAction(() => onAddRoles(selectedIds, roleKeys))}
        />
      )}

      <ConfirmDialog
        open={pendingAction === "remove"}
        title={removeTitle}
        description="They lose access to this workspace, its agents and its review campaigns. This cannot be undone."
        confirmLabel="Remove"
        error={actionError}
        isConfirming={isConfirming}
        onCancel={closeDialog}
        onConfirm={() => runAction(() => onRemoveMembers(selectedIds))}
      />
    </div>
  )
}
