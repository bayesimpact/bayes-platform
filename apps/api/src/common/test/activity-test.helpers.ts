import type { FindOptionsWhere, Repository } from "typeorm"
import type { Activity } from "@/domains/activities/activity.entity"

export function bindExpectActivityCreated(activityRepository: Repository<Activity>) {
  return async (action: string, expectedEntity?: { entityId: string; entityType: string }) => {
    const where: FindOptionsWhere<Activity> = {
      action,
    }

    const activity = await activityRepository.findOne({ where })
    expect(activity).not.toBeNull()

    if (expectedEntity) {
      expect(activity?.entityId).toBe(expectedEntity.entityId)
      expect(activity?.entityType).toBe(expectedEntity.entityType)
    }
  }
}
