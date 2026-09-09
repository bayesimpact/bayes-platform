import { cn } from "../lib/cn"

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Loading"
      className={cn("size-4 animate-spin text-gray-400", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
