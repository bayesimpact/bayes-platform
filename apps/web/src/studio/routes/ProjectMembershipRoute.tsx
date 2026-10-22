import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { DataTable } from "@/common/components/data-table/DataTable"
import { GridHeader } from "@/common/components/grid/Grid"
import { SortableFilterableHeader } from "@/common/components/shared/RecordTableParts"
import { selectCurrentProjectData } from "@/common/features/projects/projects.selectors"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { LoadingRoute } from "@/common/routes/LoadingRoute"
import { useAppSelector } from "@/common/store/hooks"
import { GroupedPermissionList } from "@/studio/features/project-memberships/components/GroupedPermissionList"
import { BadgeWithIcon } from "@/studio/features/project-memberships/components/ProjectMembershipItem"
import { ProjectRoleSelect } from "@/studio/features/project-memberships/components/ProjectRoleSelect"
import type {
  ProjectMemberAgent,
  ProjectMembership,
} from "@/studio/features/project-memberships/project-memberships.models"
import {
  selectCurrentProjectMembership,
  selectCurrentProjectMemberUserId,
  selectProjectMemberAgents,
  selectProjectMemberships,
} from "@/studio/features/project-memberships/project-memberships.selectors"
import { projectMembershipsActions } from "../features/project-memberships/project-memberships.slice"

export function ProjectMembershipRoute() {
  const memberUserId = useAppSelector(selectCurrentProjectMemberUserId)
  const memberships = useAppSelector(selectProjectMemberships)
  const memberAgents = useAppSelector(selectProjectMemberAgents)

  useMount({
    actions: {
      mount: projectMembershipsActions.memberMount,
      unmount: projectMembershipsActions.memberUnmount,
    },
    condition: !!memberUserId,
    refreshOn: [memberUserId],
  })

  if (!memberUserId) return <LoadingRoute />
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
        <ProjectRoleCard projectName={projectName} membership={membership} />

        <MemberAgentsTable memberAgents={memberAgents} />
      </div>
    </div>
  )
}

function ProjectRoleCard({
  projectName,
  membership,
}: {
  projectName: string
  membership: ProjectMembership
}) {
  const { t } = useTranslation()
  const { permissions } = membership
  return (
    <div className="flex flex-col gap-4 border rounded-lg p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-bold">{projectName}</span>
          <ProjectRoleSelect membership={membership} />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("projectMembership:profile.permissionsDescription")}
        </p>
      </div>
      {permissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("projectMembership:profile.noPermissions")}
        </p>
      ) : (
        <GroupedPermissionList permissions={permissions} />
      )}
    </div>
  )
}

const ROLE_ORDER: Record<NonNullable<ProjectMemberAgent["role"]>, number> = {
  owner: 0,
  admin: 1,
  member: 2,
}

function MemberAgentsTable({ memberAgents }: { memberAgents: ProjectMemberAgent[] }) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a sort.
  "use no memo"
  const { t } = useTranslation()
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<ProjectMemberAgent>[]>(
    () => [
      {
        id: "agent",
        accessorKey: "agentName",
        enableColumnFilter: false,
        header: ({ column }) => (
          <SortableFilterableHeader column={column} label={t("projectMembership:profile.agent")} />
        ),
        cell: ({ row }) => <span className="capitalize">{row.original.agentName}</span>,
      },
      {
        id: "role",
        accessorKey: "role",
        enableColumnFilter: false,
        header: ({ column }) => (
          <SortableFilterableHeader
            column={column}
            label={t("projectMembership:profile.agentRole")}
          />
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
      {
        id: "permissions",
        header: () => t("projectMembership:profile.agentPermissions"),
        cell: ({ row }) =>
          row.original.permissions.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <GroupedPermissionList permissions={row.original.permissions} layout="stack" />
          ),
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
    <DataTable
      table={table}
      empty={
        <p className="py-2 text-center text-muted-foreground">
          {t("projectMembership:profile.noAgents")}
        </p>
      }
    />
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
