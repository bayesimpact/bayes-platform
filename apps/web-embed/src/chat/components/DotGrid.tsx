import { cn } from "../lib/cn"

const DOTS = [6, 12, 18].flatMap((cy, row) =>
  [6, 12, 18].map((cx, col) => ({ cx, cy, step: row + col })),
)

/**
 * The 3×3 dot grid the launcher button shows: the agent's mark in the header when it has no logo,
 * so the window and the button read as one thing.
 */
export function DotGridMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-[18px]", className)} aria-hidden="true">
      {DOTS.map(({ cx, cy }) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.9} fill="currentColor" />
      ))}
    </svg>
  )
}

/**
 * The same grid with a wave running across it from the top-left corner: what the chat shows while
 * the agent thinks or calls a tool, and while a card loads, in place of a generic spinner. The
 * keyframes are in `index.css`; they stop for visitors who ask for reduced motion.
 */
export function DotGridLoader({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Loading"
      viewBox="0 0 24 24"
      className={cn("size-5 shrink-0 text-[var(--embed-accent,#6b7280)]", className)}
    >
      {DOTS.map(({ cx, cy, step }) => (
        <circle
          key={`${cx}-${cy}`}
          className="embed-dot-wave"
          style={{ animationDelay: `${step * 110}ms` }}
          cx={cx}
          cy={cy}
          r={2.1}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}
