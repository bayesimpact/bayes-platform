import { RATING_MAX } from "@bayes-platform/eval-contracts"
import { Plural } from "@lingui/react/macro"
import { cn } from "cn"
import { StarIcon } from "lucide-react"

export type StarRatingInputProps = {
  /** The rating picked, or `null` before the person picks one. */
  value: number | null
  onChange: (rating: number) => void
  /** What the stars rate, for screen readers: the text of the field's label. */
  "aria-labelledby"?: string
  "aria-label"?: string
  isInvalid?: boolean
  disabled?: boolean
}

const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1)

/** Five stars to pick a rating from 1 to 5: a radio group, one star per rating. */
export function StarRatingInput({
  value,
  onChange,
  isInvalid = false,
  disabled = false,
  ...labels
}: StarRatingInputProps) {
  return (
    <div role="radiogroup" aria-invalid={isInvalid} {...labels} className="flex w-fit gap-1">
      {STARS.map((star) => (
        // biome-ignore lint/a11y/useSemanticElements: a star is a button drawn as a star, which a native radio cannot be.
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="rounded-md p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
        >
          <StarIcon
            aria-hidden
            className={cn(
              "size-6",
              value !== null && star <= value
                ? "fill-primary text-primary"
                : "text-muted-foreground/50",
            )}
          />
          <span className="sr-only">
            <Plural value={star} one="# star" other="# stars" />
          </span>
        </button>
      ))}
    </div>
  )
}
