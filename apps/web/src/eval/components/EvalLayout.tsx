import { HorizontalNavbar } from "@/common/components/sidebar/nav/HorizontalNavbar"
import { selectMe } from "@/common/features/me/me.selectors"
import { useValue } from "@/common/hooks/use-value"

export function EvalLayout({ children }: { children: React.ReactNode }) {
  const user = useValue(selectMe)
  return (
    <>
      <HorizontalNavbar user={user} appName="Evaluation" />
      <div className="w-4/5 lg:w-3/4 mx-auto my-10 relative border rounded-2xl overflow-hidden">
        {children}
      </div>
    </>
  )
}
