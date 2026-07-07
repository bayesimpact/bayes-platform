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
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { BadgeWithIcon } from "@/studio/features/project-memberships/components/ProjectMembershipItem"
import type { ProjectMemberAgent } from "@/studio/features/project-memberships/project-memberships.models"
import {
  selectCurrentProjectMembership,
  selectCurrentProjectMembershipId,
  selectProjectMemberAgents,
  selectProjectMemberships,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import { projectMembershipsActions } from "../features/project-memberships/project-memberships.slice"

export function ProjectMembershipRoute() {
  const membershipId = useAppSelector(selectCurrentProjectMembershipId)
  const memberships = useAppSelector(selectProjectMemberships)
  const memberAgents = useAppSelector(selectProjectMemberAgents)

  useMount({
    actions: {
      mount: projectMembershipsActions.memberMount,
      unmount: projectMembershipsActions.memberUnmount,
    },
    condition: !!membershipId,
    refreshOn: [membershipId],
  })

  if (!membershipId) return <LoadingRoute />
  return (
    <AsyncRoute data={[memberships, memberAgents]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  const project = useValue(selectCurrentProjectData)
  const projectName = project.name
  const membership = useValue(selectCurrentProjectMembership)
  const memberAgents = useValue(selectProjectMemberAgents)
  const navigate = useNavigate()

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

function MemberAgentsTable({ memberAgents }: { memberAgents: ProjectMemberAgent[] }) {
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

  const table = useReactTable({
    data: memberAgents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.agentId,
  })

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
