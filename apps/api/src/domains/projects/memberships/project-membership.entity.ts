import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm"
import { Base4AllEntity } from "@/common/entities/base4all.entity"
import { User } from "@/domains/users/user.entity"
import { Project } from "../project.entity"

export type ProjectMembershipRole = "owner" | "admin" | "member"

@Entity("project_membership")
@Unique(["projectId", "userId"])
export class ProjectMembership extends Base4AllEntity {
  @Column({ type: "uuid", name: "project_id" })
  projectId!: string

  @Column({ type: "uuid", name: "user_id" })
  userId!: string

  @Column({ type: "varchar", name: "invitation_token", unique: true })
  invitationToken!: string

  @Column({ type: "varchar", default: "member" })
  role!: ProjectMembershipRole

  @ManyToOne(
    () => Project,
    (project) => project.projectMemberships,
  )
  @JoinColumn({ name: "project_id" })
  project!: Project

  @ManyToOne(
    () => User,
    (user) => user.projectMemberships,
  )
  @JoinColumn({ name: "user_id" })
  user!: User
}
