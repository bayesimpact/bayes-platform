import { useSyncExternalStore } from "react"

/** Whether an element holds other elements, as what React or a portal puts in it changes. */
export function useHasChildren(element: HTMLElement | null): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!element) return () => {}
      const observer = new MutationObserver(onChange)
      observer.observe(element, { childList: true })
      return () => observer.disconnect()
    },
    () => (element?.childElementCount ?? 0) > 0,
  )
}
