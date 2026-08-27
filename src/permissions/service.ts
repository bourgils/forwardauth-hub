import type { DataSource } from "typeorm";
import { UserApplicationAccessEntity } from "../database/entities.js";

export class PermissionService {
  constructor(private readonly dataSource: DataSource) {}

  async isAllowed(userId: string, applicationId: string): Promise<boolean> {
    const access = await this.dataSource.getRepository(UserApplicationAccessEntity).findOneBy({ userId, applicationId });
    return access?.allowed === true;
  }
}
