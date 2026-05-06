import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { User } from "@/domains/users/user.entity"

@Entity("terms_acceptance")
@Index(["userId", "createdAt"])
export class TermsAcceptance extends Base4AllEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User

  @Column({ type: "integer", name: "general_conditions_version" })
  generalConditionsVersion!: number

  @Column({ type: "integer", name: "privacy_policy_version" })
  privacyPolicyVersion!: number

  @Column({ type: "integer", name: "ai_usage_policy_version" })
  aiUsagePolicyVersion!: number

  @Column({ type: "boolean", name: "ai_usage_policy_accepted" })
  aiUsagePolicyAccepted!: boolean
}
