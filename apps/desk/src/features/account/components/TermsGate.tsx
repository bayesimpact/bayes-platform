import { useSuspenseQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { meQueryOptions } from "../api/queries"
import { TermsPage } from "./TermsPage"

export type TermsGateProps = {
  children: ReactNode
}

/**
 * Opens the Desk once the person accepted its current terms, and asks for them before. The API
 * does not hold back a person who did not accept: the Desk does.
 */
export function TermsGate({ children }: TermsGateProps) {
  const { data: me } = useSuspenseQuery(meQueryOptions())
  if (!me.user.termsAccepted) return <TermsPage terms={me.currentTerms} />
  return children
}
