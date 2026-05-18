import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDownIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { BadgeWithIcon } from "@/studio/features/project-memberships/components/ProjectMembershipItem"
import type {
  ProjectMemberAgent,
  ProjectMembership,
} from "@/studio/features/project-memberships/project-memberships.models"
import {
  selectProjectMemberAgents,
  selectProjectMemberships,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import { listProjectMemberAgents } from "@/studio/features/project-memberships/project-memberships.thunks"

export function ProjectMembershipRoute() {
  const { membershipId } = useParams<{ membershipId: string }>()
  const memberships = useAppSelector(selectProjectMemberships)
  const project = useAppSelector(selectCurrentProjectData)

  return (
    <AsyncRoute data={[memberships, project]}>
      {([membershipsValue, projectValue]) => {
        const membership = membershipsValue.find((item) => item.id === membershipId)
        if (!membership) return <ErrorRoute error="Membership not found" />
        return <WithData membership={membership} projectName={projectValue.name} />
      }}
    </AsyncRoute>
  )
}

function WithData({
  membership,
  projectName,
}: {
  membership: ProjectMembership
  projectName: string
}) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const memberAgents = useAppSelector(selectProjectMemberAgents)

  useEffect(() => {
    dispatch(listProjectMemberAgents({ membershipId: membership.id }))
  }, [dispatch, membership.id])

  const handleBack = () => {
    navigate(-1)
  }

  const displayName = membership.userName ?? membership.userEmail
  return (
    <div className="flex flex-col h-full bg-white">
      <GridHeader onBack={handleBack} title={displayName} description={membership.userEmail} />

      <div className="p-6 flex gap-6 flex-col">
        <div className="flex items-center gap-6 border rounded-lg p-4 flex-wrap justify-between">
          <div className="flex flex-col gap-2">
            <div>{projectName}</div>
            <div>{BadgeWithIcon({ role: membership.role })}</div>
          </div>
        </div>

        <MemberAgentsTable memberAgents={memberAgents} />
      </div>
    </div>
  )
}

const ROLE_ORDER: Record<NonNullable<ProjectMemberAgent["role"]>, number> = {
  owner: 0,
  admin: 1,
  member: 2,
}

function MemberAgentsTable({
  memberAgents,
}: {
  memberAgents: ReturnType<typeof selectProjectMemberAgents>
}) {
  const { t } = useTranslation()
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<ProjectMemberAgent>[]>(
    () => [
      {
        id: "agent",
        accessorKey: "agentName",
        header: ({ column }) => (
          <SortableHeader column={column} label={t("projectMembership:profile.agent")} />
        ),
        cell: ({ row }) => <span className="capitalize">{row.original.agentName}</span>,
      },
      {
        id: "role",
        accessorKey: "role",
        header: ({ column }) => (
          <SortableHeader column={column} label={t("projectMembership:profile.agentRole")} />
        ),
        cell: ({ row }) => <RoleCell memberAgent={row.original} />,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.role
          const b = rowB.original.role
          if (a === b) return 0
          if (a === null) return 1
          if (b === null) return -1
          return ROLE_ORDER[a] - ROLE_ORDER[b]
        },
      },
    ],
    [t],
  )

  const data = useMemo(
    () => (ADS.isFulfilled(memberAgents) ? memberAgents.value : []),
    [memberAgents],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.agentId,
  })

  if (ADS.isError(memberAgents)) {
    return <ErrorRoute error={memberAgents.error || "Failed to load agents"} />
  }
  if (!ADS.isFulfilled(memberAgents)) {
    return <LoadingRoute />
  }

  return (
    <div className="w-full rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-12 text-center">
                {t("projectMembership:profile.noAgents")}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function SortableHeader<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>
  label: string
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => {
        column.toggleSorting()
      }}
    >
      {label}
      <ArrowUpDownIcon className="size-3.5" />
    </button>
  )
}

function RoleCell({ memberAgent }: { memberAgent: ProjectMemberAgent }) {
  const { t } = useTranslation()
  if (!memberAgent.role) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {t("projectMembership:profile.noAccess")}
      </Badge>
    )
  }
  return <BadgeWithIcon role={memberAgent.role} />
}
