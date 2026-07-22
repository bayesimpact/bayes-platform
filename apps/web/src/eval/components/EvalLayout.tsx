import { HorizontalNavbar } from "@/common/components/sidebar/nav/HorizontalNavbar"
import { selectMe } from "@/common/features/me/me.selectors"
import { useValue } from "@/common/hooks/use-value"

export function EvalLayout({ children }: { children: React.ReactNode }) {
  const user = useValue(selectMe)
  return (
    <>
      <HorizontalNavbar user={user} appName="Evaluation" />
      <div className="mx-auto relative border-b">{children}</div>
    </>
  )
}
