import { useState } from "react"
import { type Annotation, saveAnnotation } from "../annotation"

/** The passages the person annotated, which wait for their next message and leave with it. */
export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  return {
    annotations,
    save: (annotation: Annotation) =>
      setAnnotations((current) => saveAnnotation(current, annotation)),
    clear: () => setAnnotations([]),
  }
}
