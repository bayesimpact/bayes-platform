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
import { useTranslation } from "react-i18next"
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
  type MembersTableScope,
  OWNER_ROLE_KEY,
  type ProjectRoleOption,
} from "./members-table.models"
import { useRoleLabel } from "./role-label"

type PendingAction = "addRoles" | "remove" | null

function matchesSearch(member: MembersTableMember, query: string): boolean {
  if (!query) return true
  const name = member.userName?.toLowerCase() ?? ""
  return name.includes(query) || member.userEmail.toLowerCase().includes(query)
}

/**
 * The members of a workspace or an agent, with search, filters and bulk actions. Presentational:
 * the caller passes the members, what the viewer may do, and the handlers that call the API.
 */
export function MembersTable({
  scope,
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
  scope: MembersTableScope
  members: MembersTableMember[]
  /** The roles a member can be given on the resource. */
  roles: ProjectRoleOption[]
  currentUserId: string
  canUpdateRoles: boolean
  canRemoveMembers: boolean
  /** Rejects with an `Error` whose message is shown in the dialog. */
  onAddRoles: (userIds: string[], roleKeys: string[]) => Promise<void>
  /** Rejects with an `Error` whose message is shown in the dialog. */
  onRemoveMembers: (userIds: string[]) => Promise<void>
  onOpenMember: (userId: string) => void
  toolbarAction?: ReactNode
}) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a search or a filter.
  "use no memo"
  const { t } = useTranslation()
  const roleLabel = useRoleLabel()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string[]>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: "member", desc: false }])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const canSelect = canUpdateRoles || canRemoveMembers
  const ownerRoleKey = OWNER_ROLE_KEY[scope]
  const isOwner = (member: MembersTableMember) =>
    member.roles.some((role) => role.key === ownerRoleKey)

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
      rowLabel: (member) =>
        t("projectMembership:table.selectMember", { name: member.userName ?? member.userEmail }),
    })
    const dataColumns: ColumnDef<MembersTableMember>[] = [
      {
        id: "member",
        accessorFn: (member) => member.userName ?? member.userEmail,
        enableColumnFilter: false,
        header: ({ column }) => (
          <SortableFilterableHeader column={column} label={t("projectMembership:table.member")} />
        ),
        cell: ({ row }) => {
          const member = row.original
          return (
            <div className="flex flex-col">
              <span className="flex items-center gap-2 font-medium">
                {member.userName ?? member.userEmail}
                {member.userId === currentUserId && (
                  <Badge variant="secondary">{t("projectMembership:table.you")}</Badge>
                )}
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
        header: () => (
          <span className="text-muted-foreground">{t("projectMembership:table.roles")}</span>
        ),
        cell: ({ row }) =>
          row.original.roles.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("projectMembership:table.noRole")}
            </span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.original.roles.map((role) => (
                <Badge key={role.key} variant={role.key === ownerRoleKey ? "default" : "outline"}>
                  {roleLabel(role)}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: "joined",
        accessorFn: (member) => member.createdAt,
        enableColumnFilter: false,
        header: ({ column }) => (
          <SortableFilterableHeader column={column} label={t("projectMembership:table.joined")} />
        ),
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
  }, [canSelect, currentUserId, ownerRoleKey, t, roleLabel])

  const table = useReactTable({
    data: filteredMembers,
    columns,
    state: { sorting, rowSelection, pagination },
    getRowId: (member) => member.userId,
    // Nobody changes their own roles or removes themselves from here.
    enableRowSelection: (row) => canSelect && row.original.userId !== currentUserId,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const selectedMembers = members.filter((member) => rowSelection[member.userId])
  const ownerCount = members.filter(isOwner).length
  const removeBlockedReason =
    ownerCount > 0 && selectedMembers.filter(isOwner).length === ownerCount
      ? t(`projectMembership:table.removeBlocked.${scope}`)
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
      setActionError(
        error instanceof Error ? error.message : t("projectMembership:table.genericError"),
      )
    } finally {
      setIsConfirming(false)
    }
  }

  const selectedIds = selectedMembers.map((member) => member.userId)
  const removeTitle = t("projectMembership:table.removeDialog.title", {
    count: selectedMembers.length,
    name: selectedMembers[0]?.userName ?? selectedMembers[0]?.userEmail,
  })

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
        onRowClick={(member) => onOpenMember(member.userId)}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("projectMembership:table.empty.title")}</EmptyTitle>
              <EmptyDescription>{t("projectMembership:table.empty.description")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                {t("projectMembership:table.clearFilters")}
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
          scope={scope}
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
        description={t(`projectMembership:table.removeDialog.description.${scope}`)}
        confirmLabel={t("actions:remove")}
        error={actionError}
        isConfirming={isConfirming}
        onCancel={closeDialog}
        onConfirm={() => runAction(() => onRemoveMembers(selectedIds))}
      />
    </div>
  )
}
