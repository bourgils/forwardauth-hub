import type { DataSource } from "typeorm";
import { UserApplicationActivityEntity } from "../database/entities.js";

export class ActivityService {
  constructor(private readonly dataSource: DataSource) {}

  async record(userId: string, applicationId: string, ip?: string | null): Promise<void> {
    const repository = this.dataSource.getRepository(UserApplicationActivityEntity);
    const now = new Date();
    await repository.createQueryBuilder()
      .insert()
      .values({ userId, applicationId, firstAccessAt: now, lastAccessAt: now, accessCount: 0, lastIp: ip ?? null })
      .orIgnore()
      .execute();
    await repository.createQueryBuilder()
      .update()
      .set({ lastAccessAt: now, lastIp: ip ?? null, accessCount: () => "access_count + 1" })
      .where("user_id = :userId AND application_id = :applicationId", { userId, applicationId })
      .execute();
  }
}
