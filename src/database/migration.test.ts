import "reflect-metadata";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { Logger } from "../logger.js";
import { bootstrapDatabase } from "./bootstrap.js";
import { createDataSource } from "./data-source.js";
import { ApplicationEntity, UserEntity } from "./entities.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("fresh database schema", () => {
  it("creates the complete schema and bootstraps only the administrator", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "forwardauth-schema-test-"));
    directories.push(directory);
    const config: Config = {
      port: 3000,
      databaseUrl: `sqlite:${path.join(directory, "auth.db")}`,
      sessionSecret: "schema-test-secret-with-at-least-32-characters",
      sessionTtlMs: 86_400_000,
      ssoMode: "cross-domain",
      cookieName: "coolify_auth",
      ssoCookieName: "forwardauth_sso",
      applicationCookieName: "forwardauth_app",
      cookieSecure: false,
      cookieSameSite: "lax",
      signupEnabled: false,
      adminUiEnabled: true,
      publicUrl: "http://localhost",
      bootstrapAdminUsername: "admin",
      bootstrapAdminPassword: "correct horse battery staple",
      trustedProxies: ["loopback"],
      loginStateTtlMs: 600_000,
      authorizationCodeTtlMs: 60_000,
      callbackPath: "/_forwardauth/callback",
      logLevel: "error",
    };
    const dataSource = createDataSource(config);
    await dataSource.initialize();
    await bootstrapDatabase(dataSource, config, new Logger("error"));

    const tables = (await dataSource.query("SELECT name FROM sqlite_master WHERE type = 'table'") as Array<{ name: string }>).map((row) => row.name);
    expect(tables).toEqual(expect.arrayContaining([
      "users",
      "applications",
      "groups",
      "user_groups",
      "group_application_access",
      "sessions",
      "authorization_codes",
      "user_application_activity",
      "audit_logs",
    ]));
    expect(await dataSource.getRepository(UserEntity).count()).toBe(1);
    expect(await dataSource.getRepository(ApplicationEntity).count()).toBe(0);
    expect(await dataSource.getRepository(UserEntity).findOneByOrFail({ username: "admin" })).toMatchObject({ role: "admin", enabled: true, accessStartsAt: null, accessEndsAt: null });
    await dataSource.destroy();
  });
});
