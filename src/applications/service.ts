import type { DataSource } from "typeorm";
import { ApplicationEntity } from "../database/entities.js";
import type { Application } from "../types.js";

export class ApplicationService {
  constructor(private readonly dataSource: DataSource) {}

  findEnabledByHostname(hostname: string): Promise<Application | null> {
    return this.dataSource.getRepository(ApplicationEntity).findOneBy({ hostname, enabled: true });
  }
}
