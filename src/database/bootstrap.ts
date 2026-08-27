import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import type { Config } from "../config.js";
import { hashPassword } from "../auth/crypto.js";
import { normalizeHostname } from "../applications/hostnames.js";
import { ApplicationEntity, UserEntity } from "./entities.js";
import type { Logger } from "../logger.js";

export async function bootstrapDatabase(dataSource: DataSource, config: Config, logger: Logger): Promise<void> {
  const users = dataSource.getRepository(UserEntity);
  if (await users.count() === 0) {
    if (config.bootstrapAdminUsername && config.bootstrapAdminPassword) {
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
        createdAt: now,
        updatedAt: now,
      });
      logger.info("Bootstrap administrator created", { username });
    } else {
      logger.warn("Database has no users and bootstrap administrator credentials are incomplete");
    }
  }

  const applications = dataSource.getRepository(ApplicationEntity);
  for (const configuredHost of config.allowedRedirects) {
    const hostname = normalizeHostname(configuredHost);
    if (!hostname) throw new Error(`Invalid hostname in ALLOWED_REDIRECTS: ${configuredHost}`);
    if (await applications.existsBy({ hostname })) continue;
    const now = new Date();
    await applications.insert({
      id: randomUUID(),
      name: hostname,
      hostname,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    logger.info("Application bootstrapped", { hostname });
  }
}
