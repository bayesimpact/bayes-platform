import { Trans } from "@lingui/react/macro"
import { useBlocker } from "@tanstack/react-router"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"

export type UnsavedChangesGuardProps = {
  /** Read when the person leaves, so a change made just before counts. */
  hasUnsavedChanges: () => boolean
}

/**
 * Asks before the person leaves a page with changes not saved: to another page of the app, or
 * away from it, where the browser asks. A move within the page, such as another step, goes on.
 */
export function UnsavedChangesGuard({ hasUnsavedChanges }: UnsavedChangesGuardProps) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => current.pathname !== next.pathname && hasUnsavedChanges(),
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  })
  return (
    <ConfirmDialog
      isOpen={blocker.status === "blocked"}
      onOpenChange={(isOpen) => {
        if (!isOpen) blocker.reset?.()
      }}
      title={<Trans>Leave without saving?</Trans>}
      description={
        <Trans>The changes to this step are not saved yet. They are lost if you leave.</Trans>
      }
      confirmLabel={<Trans comment="Leaves a page whose changes are not saved">Leave</Trans>}
      isDestructive
      isPending={false}
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
