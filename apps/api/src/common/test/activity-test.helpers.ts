import type { FindOptionsWhere, Repository } from "typeorm"
import type { Activity } from "@/domains/activities/activity.entity"

export function bindExpectActivityCreated(activityRepository: Repository<Activity>) {
  return async (
    action: string,
    expected?: Partial<{
      userId: string | null
      organizationId: string | null
      projectId: string | null
      entityId: string | null
      entityType: string | null
    }>,
  ) => {
    const where: FindOptionsWhere<Activity> = {
      action,
    }

    const activity = await activityRepository.findOne({ where })
    expect(activity).toMatchObject({ action, ...expected })
  }
}
