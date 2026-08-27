import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import type { Config } from "../config.js";
import { hashPassword } from "../auth/crypto.js";
import { UserEntity } from "./entities.js";
import type { Logger } from "../logger.js";

export async function bootstrapDatabase(dataSource: DataSource, config: Config, logger: Logger): Promise<void> {
  const users = dataSource.getRepository(UserEntity);
  if (await users.count() === 0) {
    if (!config.bootstrapAdminUsername || !config.bootstrapAdminPassword) {
      throw new Error("BOOTSTRAP_ADMIN_USERNAME and BOOTSTRAP_ADMIN_PASSWORD are required for an empty database");
    }
    const username = config.bootstrapAdminUsername.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username)) {
      throw new Error("BOOTSTRAP_ADMIN_USERNAME is invalid");
    }
    if (config.bootstrapAdminPassword.length < 12) {
      throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters");
    }
    const now = new Date();
    await users.insert({
      id: randomUUID(),
      username,
      email: null,
      passwordHash: await hashPassword(config.bootstrapAdminPassword),
      role: "admin",
      enabled: true,
      accessStartsAt: null,
      accessEndsAt: null,
      createdAt: now,
      updatedAt: now,
    });
    logger.info("Bootstrap administrator created", { username });
  }
}
