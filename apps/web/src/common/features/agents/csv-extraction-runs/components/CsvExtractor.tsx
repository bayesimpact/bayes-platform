import {
  AGENT_CSV_EXTRACTION_RUN_COLUMN_ROLES,
  type AgentCsvExtractionRunColumnRoleDto,
  type AgentCsvExtractionRunColumnSchemaDto,
} from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { Label } from "@caseai-connect/ui/shad/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@caseai-connect/ui/shad/select"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { Loader } from "@/common/components/Loader"
import { RunScopeSelector } from "@/common/components/shared/RunScopeSelector"
import { selectCurrentOrganizationId } from "@/common/features/organizations/organizations.selectors"
import { selectCurrentProjectId } from "@/common/features/projects/projects.selectors"
import { useCurrentId } from "@/common/hooks/use-value"
import type { BuildAgentExtractionCsvRunRoute } from "@/common/routes/build-routes/context"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { selectCurrentAgentId } from "../../agents.selectors"
import {
  selectFileColumnsData,
  selectIsExecutingCsvRun,
} from "../agent-csv-extraction-runs.selectors"
import { agentCsvExtractionRunsActions } from "../agent-csv-extraction-runs.slice"

type ColumnEntry = {
  id: string
  originalName: string
  finalName: string
  role: AgentCsvExtractionRunColumnRoleDto
  index: number
}

export function CsvExtractor({
  documentId,
  onBack,
  buildCsvRunPath,
}: {
  onBack: () => void
  documentId: string
  buildCsvRunPath: BuildAgentExtractionCsvRunRoute
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const isExecuting = useAppSelector(selectIsExecutingCsvRun)
  const fileColumnsData = useAppSelector(selectFileColumnsData)
  const organizationId = useCurrentId(selectCurrentOrganizationId)
  const projectId = useCurrentId(selectCurrentProjectId)
  const agentId = useCurrentId(selectCurrentAgentId)
  const handleRunCreated = useCallback(
    (csvRunId: string) => {
      navigate(buildCsvRunPath({ organizationId, projectId, agentId, csvRunId }))
    },
    [navigate, buildCsvRunPath, organizationId, projectId, agentId],
  )

  const [_step, _setStep] = useState<"columns" | "scope">("columns")
  const [columns, setColumns] = useState<ColumnEntry[]>([])
  const [selectedColumnIds, setSelectedColumnIds] = useState<Set<string>>(new Set())
  const [bulkRole, setBulkRole] = useState<AgentCsvExtractionRunColumnRoleDto>("input")
  const [runScope, setRunScope] = useState<"all" | "limited">("all")
  const [limitedCount, setLimitedCount] = useState(10)

  const handleRoleChange = useCallback(
    (columnId: string, role: AgentCsvExtractionRunColumnRoleDto) => {
      setColumns((prev) =>
        prev.map((column) => (column.id === columnId ? { ...column, role } : column)),
      )
    },
    [],
  )

  const handleToggleSelect = useCallback((columnId: string) => {
    setSelectedColumnIds((prev) => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        next.delete(columnId)
      } else {
        next.add(columnId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedColumnIds((prev) => {
      if (prev.size === columns.length) return new Set()
      return new Set(columns.map((column) => column.id))
    })
  }, [columns])

  const handleBulkApply = useCallback(() => {
    setColumns((prev) =>
      prev.map((column) =>
        selectedColumnIds.has(column.id) ? { ...column, role: bulkRole } : column,
      ),
    )
    setSelectedColumnIds(new Set())
  }, [selectedColumnIds, bulkRole])

  const handleLimitedCountChange = useCallback((value: string) => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed)) {
      setLimitedCount(Math.max(1, parsed))
    }
  }, [])

  const handleRun = useCallback(async () => {
    const columnSchema: AgentCsvExtractionRunColumnSchemaDto = {}
    for (const column of columns) {
      columnSchema[column.id] = {
        id: column.id,
        originalName: column.originalName,
        finalName: column.finalName,
        role: column.role,
        index: column.index,
      }
    }

    dispatch(
      agentCsvExtractionRunsActions.createAndExecute({
        agentId,
        documentId,
        columnSchema,
        recordLimit: runScope === "limited" ? limitedCount : null,
        onSuccess: handleRunCreated,
      }),
    )
  }, [agentId, documentId, columns, runScope, limitedCount, dispatch, handleRunCreated])

  const isFileColumnsLoading = ADS.isLoading(fileColumnsData)
  const allSelected = selectedColumnIds.size === columns.length && columns.length > 0

  const canProceedToScope = useMemo(() => columns.length > 0, [columns])

  useEffect(() => {
    if (isFileColumnsLoading || !fileColumnsData.value) return
    setColumns(
      fileColumnsData.value.map((column, index) => ({
        id: column.id,
        originalName: column.name,
        finalName: column.name,
        role: "input",
        index,
      })),
    )
  }, [isFileColumnsLoading, fileColumnsData])

  return (
    <div className="bg-white">
      <GridHeader
        title={t("agentCsvExtractionRun:dialog.title")}
        description={t("agentCsvExtractionRun:dialog.description")}
        onBack={onBack}
      />

      {isFileColumnsLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader />
        </div>
      ) : (
        canProceedToScope && (
          <div className="flex flex-col gap-6 p-6">
            <ColumnsStep
              columns={columns}
              selectedColumnIds={selectedColumnIds}
              allSelected={allSelected}
              bulkRole={bulkRole}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onRoleChange={handleRoleChange}
              onBulkRoleChange={setBulkRole}
              onBulkApply={handleBulkApply}
            />

            <RunScopeSelector
              recordCount={null}
              runScope={runScope}
              limitedCount={limitedCount}
              onRunScopeChange={setRunScope}
              onLimitedCountChange={handleLimitedCountChange}
            />

            <div className="flex justify-end gap-2">
              <Button onClick={handleRun} disabled={isExecuting}>
                {isExecuting
                  ? t("agentCsvExtractionRun:results.running")
                  : t("agentCsvExtractionRun:dialog.run")}
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  )
}

function ColumnsStep({
  columns,
  selectedColumnIds,
  allSelected,
  bulkRole,
  onToggleSelect,
  onSelectAll,
  onRoleChange,
  onBulkRoleChange,
  onBulkApply,
}: {
  columns: ColumnEntry[]
  selectedColumnIds: Set<string>
  allSelected: boolean
  bulkRole: AgentCsvExtractionRunColumnRoleDto
  onToggleSelect: (columnId: string) => void
  onSelectAll: () => void
  onRoleChange: (columnId: string, role: AgentCsvExtractionRunColumnRoleDto) => void
  onBulkRoleChange: (role: AgentCsvExtractionRunColumnRoleDto) => void
  onBulkApply: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label>{t("agentCsvExtractionRun:columns.title")}</Label>
        <p className="text-sm text-muted-foreground">
          {t("agentCsvExtractionRun:columns.description")}
        </p>
      </div>

      {selectedColumnIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {t("agentCsvExtractionRun:columns.selectedCount", { count: selectedColumnIds.size })}
          </span>
          <Select
            value={bulkRole}
            onValueChange={(value) => onBulkRoleChange(value as AgentCsvExtractionRunColumnRoleDto)}
          >
            <SelectTrigger className="w-32" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENT_CSV_EXTRACTION_RUN_COLUMN_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {t(`agentCsvExtractionRun:columns.roles.${role}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={onBulkApply}>
            {t("agentCsvExtractionRun:columns.bulkApply")}
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="grid grid-cols-[auto_1fr_auto] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sticky top-0">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
            aria-label={t("agentCsvExtractionRun:columns.selectAll")}
          />
          <span>{t("agentCsvExtractionRun:columns.columnHeader")}</span>
          <span>{t("agentCsvExtractionRun:columns.roleHeader")}</span>
        </div>
        {columns.map((column) => (
          <div
            key={column.id}
            className="grid grid-cols-[auto_1fr_auto] gap-2 border-t px-3 py-2 items-center"
          >
            <Checkbox
              checked={selectedColumnIds.has(column.id)}
              onCheckedChange={() => onToggleSelect(column.id)}
              aria-label={column.finalName}
            />
            <span className="text-sm font-mono truncate">{column.finalName}</span>
            <Select
              value={column.role}
              onValueChange={(value) =>
                onRoleChange(column.id, value as AgentCsvExtractionRunColumnRoleDto)
              }
            >
              <SelectTrigger className="w-28" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_CSV_EXTRACTION_RUN_COLUMN_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`agentCsvExtractionRun:columns.roles.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}
