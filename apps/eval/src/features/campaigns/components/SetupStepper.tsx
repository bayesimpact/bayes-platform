import { useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMediaQuery } from "@/hooks/use-media-query"
import { SETUP_STEPS, type SetupStep } from "../schemas"
import { SETUP_STEP_LABELS } from "../setup-steps"

export type SetupStepperProps = {
  currentStep: SetupStep
  /** Whether a step can be opened from the stepper: those the person can come back to. */
  canOpen: (step: SetupStep) => boolean
  onOpen: (step: SetupStep) => void
}

/**
 * Where the person stands in a campaign's setup: each step with its number, those before the
 * current one checked. A step the person can come back to opens on a click. Below a wide window,
 * only the current step keeps its name: a tooltip names the others.
 */
export function SetupStepper({ currentStep, canOpen, onOpen }: SetupStepperProps) {
  const { t, i18n } = useLingui()
  const currentIndex = SETUP_STEPS.indexOf(currentStep)
  // Tailwind's `xl`: below it, only the current step keeps its name, and a tooltip names the others.
  const isWide = useMediaQuery("(min-width: 80rem)")
  return (
    <nav aria-label={t`Steps of the setup`}>
      <ol className="flex flex-wrap items-center gap-x-0.5 gap-y-2">
        {SETUP_STEPS.map((step, index) => {
          const isCurrent = step === currentStep
          const isDone = index < currentIndex
          const label = i18n._(SETUP_STEP_LABELS[step])
          const isOpenable = !isCurrent && canOpen(step)
          const stepProps = {
            number: index + 1,
            label,
            isCurrent,
            isDone,
            isOpenable,
            isLabelShown: isCurrent || isWide,
            onOpen: () => onOpen(step),
          }
          return (
            <li key={step} className="flex items-center gap-0.5">
              {index > 0 ? <span aria-hidden className="h-px w-2 bg-border 2xl:w-5" /> : null}
              {isCurrent || isWide ? (
                <StepButton {...stepProps} />
              ) : (
                <Tooltip>
                  <TooltipTrigger render={<StepButton {...stepProps} />} />
                  <TooltipContent side="bottom">{label}</TooltipContent>
                </Tooltip>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

type StepButtonProps = ComponentProps<"button"> & {
  number: number
  label: string
  isCurrent: boolean
  isDone: boolean
  isOpenable: boolean
  /** Whether the step's name shows beside its number, or only to screen readers. */
  isLabelShown: boolean
  onOpen: () => void
}

/** A step of the stepper: its number, or a check once done, and its name. */
function StepButton({
  number,
  label,
  isCurrent,
  isDone,
  isOpenable,
  isLabelShown,
  onOpen,
  ...props
}: StepButtonProps) {
  return (
    <button
      type="button"
      {...props}
      // Focusable even when it does not open, so its tooltip names it to the keyboard too.
      aria-disabled={!isOpenable}
      aria-current={isCurrent ? "step" : undefined}
      data-label={isLabelShown ? "shown" : "hidden"}
      onClick={(event) => {
        props.onClick?.(event)
        if (isOpenable) onOpen()
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-full p-0.5 text-sm data-[label=shown]:pr-2.5",
        isOpenable ? "hover:bg-muted" : "cursor-default",
        isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
          isCurrent && "border-primary bg-primary text-primary-foreground",
          isDone && "border-primary text-primary",
        )}
      >
        {isDone ? <CheckIcon className="size-3.5" /> : number}
      </span>
      <span className={cn(!isLabelShown && "sr-only")}>{label}</span>
    </button>
  )
}
