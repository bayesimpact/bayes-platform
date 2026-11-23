import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import type { Participant } from "../participants"
import { CampaignRoleLabel } from "./CampaignRoleLabel"

const columnHelper = createColumnHelper<Participant>()

/** The texts of the headers and cells, which the table translates. */
const participantColumnLabels = {
  email: msg({ message: "Email", comment: "The email address of a participant" }),
  role: msg({ message: "Role", comment: "The role of a participant in a review campaign" }),
  neverSignedIn: msg({
    message: "Never signed in",
    comment: "A person who was invited and never came",
  }),
} satisfies Record<string, MessageDescriptor>

/** The columns of a campaign's participants; the last one holds each row's action. */
export function participantColumnsOf({
  translate,
  renderActions,
}: {
  translate: (descriptor: MessageDescriptor) => string
  /** The actions of a row, or `null` when the campaign takes no change. */
  renderActions: ((participant: Participant) => ReactNode) | null
}): ColumnDef<Participant, unknown>[] {
  const columns: ColumnDef<Participant, unknown>[] = [
    columnHelper.accessor("email", {
      header: translate(participantColumnLabels.email),
      cell: (context) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-all">{context.getValue()}</span>
          {context.row.original.hasSignedIn ? null : (
            <Badge variant="secondary">{translate(participantColumnLabels.neverSignedIn)}</Badge>
          )}
        </span>
      ),
    }) as ColumnDef<Participant, unknown>,
    columnHelper.accessor("role", {
      header: translate(participantColumnLabels.role),
      cell: (context) => (
        <Badge variant="outline">
          <CampaignRoleLabel campaignRole={context.getValue()} />
        </Badge>
      ),
    }) as ColumnDef<Participant, unknown>,
  ]
  if (renderActions) {
    columns.push(
      columnHelper.display({
        id: "actions",
        cell: (context) => renderActions(context.row.original),
        meta: { headerClassName: "w-24", cellClassName: "w-24 text-right" },
      }),
    )
  }
  return columns
}
