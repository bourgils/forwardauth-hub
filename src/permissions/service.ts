import type { DataSource } from "typeorm";
import { ApplicationEntity, GroupApplicationAccessEntity } from "../database/entities.js";
import type { Application, User } from "../types.js";

export type AccessDenialReason = "disabled_user" | "access_not_started" | "access_expired" | "application_disabled" | "permission_denied";

export interface AccessDecision {
  allowed: boolean;
  reason?: AccessDenialReason;
}

export function userAccessDenialReason(user: User, now = new Date()): AccessDenialReason | undefined {
  if (!user.enabled) return "disabled_user";
  if (user.accessStartsAt && user.accessStartsAt.getTime() > now.getTime()) return "access_not_started";
  if (user.accessEndsAt && user.accessEndsAt.getTime() <= now.getTime()) return "access_expired";
  return undefined;
}

export function isUserActive(user: User, now = new Date()): boolean {
  return userAccessDenialReason(user, now) === undefined;
}

export class AccessPolicyService {
  constructor(private readonly dataSource: DataSource) {}

  async evaluate(user: User, application: Application, now = new Date()): Promise<AccessDecision> {
    const userReason = userAccessDenialReason(user, now);
    if (userReason) return { allowed: false, reason: userReason };
    if (!application.enabled) return { allowed: false, reason: "application_disabled" };
    if (user.role === "admin") return { allowed: true };

    const allowed = await this.dataSource.getRepository(GroupApplicationAccessEntity)
      .createQueryBuilder("access")
      .innerJoin("groups", "access_group", "access_group.id = access.group_id AND access_group.enabled = :enabled", { enabled: true })
      .innerJoin("user_groups", "membership", "membership.group_id = access.group_id AND membership.user_id = :userId", { userId: user.id })
      .where("access.application_id = :applicationId", { applicationId: application.id })
      .getExists();
    return allowed ? { allowed: true } : { allowed: false, reason: "permission_denied" };
  }

  async listAllowedApplications(user: User): Promise<Application[]> {
    if (!isUserActive(user)) return [];
    const applications = this.dataSource.getRepository(ApplicationEntity);
    if (user.role === "admin") return applications.find({ where: { enabled: true }, order: { name: "ASC" } });

    return applications.createQueryBuilder("application")
      .distinct(true)
      .innerJoin("group_application_access", "access", "access.application_id = application.id")
      .innerJoin("groups", "access_group", "access_group.id = access.group_id AND access_group.enabled = :enabled", { enabled: true })
      .innerJoin("user_groups", "membership", "membership.group_id = access.group_id AND membership.user_id = :userId", { userId: user.id })
      .where("application.enabled = :enabled", { enabled: true })
      .orderBy("application.name", "ASC")
      .getMany();
  }
}
