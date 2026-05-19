import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { Input } from "@caseai-connect/ui/shad/input"
import { Label } from "@caseai-connect/ui/shad/label"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { selectIsPremiumMember } from "@/common/features/me/me.selectors"
import {
  selectOrganizationsError,
  selectOrganizationsStatus,
} from "@/common/features/organizations/organizations.selectors"
import { createOrganization } from "@/common/features/organizations/organizations.thunks"
import { ErrorRoute } from "@/common/routes/ErrorRoute"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { FullPageCenterLayout } from "../layouts/FullPageCenterLayout"

export function OrganizationCreator() {
  const isPremiumUser = useAppSelector(selectIsPremiumMember)
  const { t } = useTranslation("organization", { keyPrefix: "createForm" })
  const dispatch = useAppDispatch()
  const status = useAppSelector(selectOrganizationsStatus)
  const error = useAppSelector(selectOrganizationsError)

  const createOrganizationSchema = z.object({
    name: z.string().min(3, t("validation.minNameLength")),
  })

  type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
  })

  const onSubmit = (data: CreateOrganizationFormData) => {
    dispatch(createOrganization({ name: data.name }))
  }

  const isLoading = ADS.isLoading(status)
  if (!isPremiumUser) {
    return <ErrorRoute error={t("notAllowed")} />
  }
  return (
    <FullPageCenterLayout className="min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("labelName")}</Label>
              <Input
                id="name"
                placeholder={t("placeholderName")}
                {...register("name")}
                disabled={isLoading}
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              {error && !errors.name && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </CardContent>
          <CardFooter className="mt-2">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? t("submitting") : t("submit")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FullPageCenterLayout>
  )
}
