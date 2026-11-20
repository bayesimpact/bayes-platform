import { useEffect, useId, useRef } from "react"
import { cn } from "../lib/cn"

const C = 12
// The eight outer dots, clockwise from the top.
const RING = [
  [12, 6],
  [18, 6],
  [18, 12],
  [18, 18],
  [12, 18],
  [6, 18],
  [6, 12],
  [6, 6],
] as const
const SLOTS = [[C, C], ...RING] as const
// The logo's proportions: dots half the spacing across, links as wide as a dot, so the whole star
// is the logo itself.
const R = 1.5
const LINK = 3

/**
 * The 3×3 dot grid the launcher button shows: the agent's mark in the header when it has no logo,
 * so the window and the button read as one thing.
 */
export function DotGridMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-[18px]", className)} aria-hidden="true">
      {SLOTS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.9} fill="currentColor" />
      ))}
    </svg>
  )
}

/**
 * What the chat shows while the agent thinks or calls a tool, and while a card loads: the eight
 * links of the star come in a random order, each drawn from either end, and stay; each dot lights
 * with a small bounce as a link reaches it; once the star is whole a sheen crosses it, the links
 * withdraw and the nine dots swap places before the next draw. Visitors who ask for reduced
 * motion see the star, still and faint.
 */
export function DotGridLoader({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const id = useId().replace(/:/g, "")

  useEffect(() => {
    const svg = ref.current
    if (!svg || typeof svg.animate !== "function") return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    return runRandomStar(svg)
  }, [])

  return (
    <svg
      ref={ref}
      role="img"
      aria-label="Loading"
      viewBox="0 0 24 24"
      overflow="visible"
      className={cn("embed-star size-5 shrink-0 text-[var(--embed-accent,#6b7280)]", className)}
    >
      <defs>
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="8" y2="8">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          {RING.map(([x, y]) => (
            <line
              key={`${x}-${y}`}
              x1={C}
              y1={C}
              x2={x}
              y2={y}
              stroke="#fff"
              strokeWidth={LINK + 0.2}
              strokeLinecap="round"
            />
          ))}
          {SLOTS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={R + 0.3} fill="#fff" />
          ))}
        </mask>
      </defs>
      <g>
        {RING.map(([x, y]) => (
          <line
            key={`${x}-${y}`}
            className="embed-star-link"
            x1={C}
            y1={C}
            x2={x}
            y2={y}
            pathLength={1}
            stroke="currentColor"
            strokeWidth={LINK}
            strokeLinecap="round"
          />
        ))}
      </g>
      {SLOTS.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          className={i ? "embed-star-dot" : "embed-star-dot embed-star-centre"}
          cx={x}
          cy={y}
          r={R}
          fill="currentColor"
        />
      ))}
      <g mask={`url(#${id}m)`} pointerEvents="none">
        <rect
          className="embed-star-sheen"
          x="-8"
          y="-8"
          width="8"
          height="8"
          fill={`url(#${id}g)`}
          transform="scale(4) translate(-1 -1)"
          opacity="0"
        />
      </g>
    </svg>
  )
}

/** Runs the loader's cycle with the Web Animations API; returns the function that stops it. */
function runRandomStar(svg: SVGSVGElement): () => void {
  const links = [...svg.querySelectorAll<SVGLineElement>(".embed-star-link")]
  const dots = [...svg.querySelectorAll<SVGCircleElement>(".embed-star-dot")]
  const [centre, ...ring] = dots
  const band = svg.querySelector<SVGRectElement>(".embed-star-sheen")
  if (!centre) return () => {}
  svg.classList.add("embed-star--js")
  let stopped = false
  let timer = 0
  const running = new Set<Animation>()
  const play = (el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    const a = el.animate(frames, { fill: "forwards", easing: "cubic-bezier(.45,0,.2,1)", ...opts })
    running.add(a)
    a.finished.then(
      () => running.delete(a),
      () => running.delete(a),
    )
  }
  const shuffle = <T,>(items: T[]) =>
    items
      .map((v) => [Math.random(), v] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v)
  // Up past its size, a little under, then still.
  const light = (dot: Element, delay: number) =>
    play(
      dot,
      [
        { transform: "scale(.75)", opacity: 0.45 },
        { transform: "scale(1.2)", opacity: 1, offset: 0.45 },
        { transform: "scale(.95)", opacity: 1, offset: 0.75 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 550, delay, easing: "cubic-bezier(.3,.7,.4,1)" },
    )
  const reset = () => {
    for (const a of running) a.cancel()
    running.clear()
    for (const l of links) l.style.opacity = "0"
    for (const d of dots) {
      d.style.opacity = ".45"
      d.style.transform = "scale(.75)"
    }
  }
  const cycle = () => {
    if (stopped) return
    reset()
    const step = 150
    const draw = 260
    let centreAt = Number.POSITIVE_INFINITY
    shuffle(links.map((_, k) => k)).forEach((k, n) => {
      const link = links[k]
      const dot = ring[k]
      if (!link || !dot) return
      const outward = Math.random() < 0.5
      const delay = 120 + n * step
      // Drawn from the centre (the dash starts at x1) or towards it (the dash runs backwards).
      play(
        link,
        [
          { strokeDashoffset: outward ? 1 : -1, opacity: 0.9 },
          { strokeDashoffset: 0, opacity: 0.9 },
        ],
        { duration: draw, delay },
      )
      light(dot, outward ? delay + draw * 0.8 : delay)
      centreAt = Math.min(centreAt, outward ? delay : delay + draw * 0.8)
    })
    light(centre, centreAt)
    let at = 120 + 7 * step + draw
    if (band)
      play(
        band,
        [
          { transform: "scale(4) translate(-1px, -1px)", opacity: 1 },
          { transform: "scale(4) translate(1px, 1px)", opacity: 1 },
        ],
        { duration: 650, delay: at + 80, easing: "ease-in-out" },
      )
    at += 80 + 650 + 250
    for (const l of links)
      play(
        l,
        [
          { strokeDashoffset: 0, opacity: 0.9 },
          { strokeDashoffset: 1, opacity: 0.2 },
        ],
        { duration: 300, delay: at },
      )
    at += 280
    // The dots slide to one another's places; identical, they return to their own in one frame
    // without it showing, and the next cycle starts from the plain grid.
    const perm = shuffle(SLOTS.map((_, i) => i))
    dots.forEach((d, i) => {
      const [x0, y0] = SLOTS[i] ?? [C, C]
      const [x1, y1] = SLOTS[perm[i] ?? i] ?? [x0, y0]
      play(
        d,
        [
          { translate: "0px 0px", opacity: 0.9 },
          { translate: `${x1 - x0}px ${y1 - y0}px`, opacity: 0.9 },
        ],
        { duration: 520, delay: at, easing: "cubic-bezier(.65,0,.35,1)" },
      )
    })
    timer = window.setTimeout(cycle, at + 560)
  }
  cycle()
  return () => {
    stopped = true
    window.clearTimeout(timer)
    for (const a of running) a.cancel()
    svg.classList.remove("embed-star--js")
  }
}
