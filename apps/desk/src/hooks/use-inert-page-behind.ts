import { type RefObject, useEffect } from "react"

/**
 * Makes the page behind an element inert while the element covers it, as a modal dialog does:
 * nothing behind it can take the focus, a click or a screen reader. It walks up from the element
 * to the frame `boundarySelector` names, and sets `inert` on the siblings on its way, so what
 * sits outside the frame (dialogs, menus and toasts in their portals) stays usable. The DOM is
 * outside React, which an effect follows.
 */
export function useInertPageBehind(
  elementRef: RefObject<HTMLElement | null>,
  isCovering: boolean,
  boundarySelector: string,
): void {
  useEffect(() => {
    const element = elementRef.current
    const boundary = element?.closest(boundarySelector)
    if (!isCovering || !element || !boundary) return
    const madeInert: Element[] = []
    for (let node: Element = element; node !== boundary; ) {
      const parent = node.parentElement
      if (!parent) break
      for (const sibling of parent.children) {
        if (sibling === node || sibling.hasAttribute("inert")) continue
        sibling.setAttribute("inert", "")
        madeInert.push(sibling)
      }
      node = parent
    }
    return () => {
      for (const sibling of madeInert) sibling.removeAttribute("inert")
    }
  }, [elementRef, isCovering, boundarySelector])
}
