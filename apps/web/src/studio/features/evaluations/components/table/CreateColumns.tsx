import { Badge } from "@caseai-connect/ui/shad/badge"
import { cn } from "@caseai-connect/ui/utils"
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import type { z } from "zod"
import { buildDate } from "@/common/utils/build-date"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"
import { DefaultPromptDialog } from "@/studio/features/agents/components/DefaultPromptDialog"
import type { schema } from "./schema"

export function createColumns({ t }: { t: TFunction }): ColumnDef<z.infer<typeof schema>>[] {
  return [
    {
      accessorKey: "createdAt",
      header: t("evaluationReport:props.createdAt"),
      cell: ({ row }) => {
        return <div className="text-muted-foreground">{buildDate(row.original.createdAt)}</div>
      },
      enableHiding: false,
    },
    {
      accessorKey: "status",
      header: t("evaluationReport:status"),
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge
            variant="outline"
            className={cn(
              "text-muted-foreground px-1.5 select-none",
              status === "loading" && "animate-pulse",
            )}
          >
            {status === "done" ? (
              <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
            ) : status === "loading" ? (
              <IconLoader className="animate-spin" />
            ) : null}
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "agent",
      header: t("agent:agent"),
      cell: ({ row }) => {
        return row.original.agent ? (
          <div className="text-muted-foreground text-xs flex flex-col gap-1.5">
            <div>
              <span>{t("agent:props.name", { colon: true })}</span>{" "}
              <span className="font-semibold">{row.original.agent.name}</span>
            </div>
            <div>
              <span>{t("agent:props.model", { colon: true })}</span>{" "}
              <span className="font-semibold">{row.original.agent.model}</span>
            </div>
            <div>
              <span>{t("agent:props.locale", { colon: true })}</span>{" "}
              <span className="font-semibold">{row.original.agent.locale}</span>
            </div>
            <div>
              <span>{t("agent:props.temperature", { colon: true })}</span>{" "}
              <span className="font-semibold">{row.original.agent.temperature}</span>
            </div>
            <DefaultPromptDialog
              buttonProps={{ variant: "secondary", size: "sm", className: "w-fit" }}
              prompt={row.original.agent.instructions}
            />
          </div>
        ) : null
      },
      enableHiding: false,
    },
    {
      accessorKey: "output",
      header: t("evaluationReport:props.output"),
      cell: ({ row }) => {
        return <div className="max-w-52 whitespace-break-spaces">{row.original.output}</div>
      },
      enableHiding: false,
    },
    {
      accessorKey: "score",
      header: () => <div>{t("evaluationReport:props.score")}</div>,
      cell: ({ row }) => (row.original.score ? <Badge>{row.original.score}</Badge> : null),
    },
    {
      accessorKey: "traceUrl",
      header: () => <></>,
      cell: ({ row }) => <TraceUrlOpener traceUrl={row.original.traceUrl} />,
    },
  ]
}
