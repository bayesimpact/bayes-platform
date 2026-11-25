import { RATING_MAX } from "@bayes-platform/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { StarIcon } from "lucide-react"

export type StarRatingProps = {
  rating: number
  /** Whether the number follows the stars, as "4/5". */
  hasNumber?: boolean
}

/** The stars of a rating, out of five. */
const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1)

/** A rating someone gave, as filled stars out of five, read as one sentence. */
export function StarRating({ rating, hasNumber = true }: StarRatingProps) {
  const { t } = useLingui()
  const maxRating = RATING_MAX
  return (
    <span className="inline-flex items-center gap-2">
      <span role="img" aria-label={t`Rated ${rating} out of ${maxRating}`} className="flex gap-0.5">
        {STARS.map((star) => (
          <StarIcon
            key={star}
            aria-hidden
            className={cn(
              "size-4",
              star <= rating ? "fill-primary text-primary" : "text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      {hasNumber ? (
        <span aria-hidden className="text-sm text-muted-foreground tabular-nums">
          {rating}/{RATING_MAX}
        </span>
      ) : null}
    </span>
  )
}
