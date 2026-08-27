import "reflect-metadata";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DataSource } from "typeorm";
import { afterEach, describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { createDataSource } from "./data-source.js";
import { InitialSchema1724700000000 } from "./migrations/1724700000000-InitialSchema.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("cross-domain database migration", () => {
  it("upgrades an existing SQLite database without losing sessions", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "forwardauth-migration-test-"));
    directories.push(directory);
    const database = path.join(directory, "auth.db");
    const legacy = new DataSource({
      type: "better-sqlite3",
      database,
      migrations: [InitialSchema1724700000000],
      migrationsRun: true,
    });
    await legacy.initialize();
    const now = new Date().toISOString();
    await legacy.query("INSERT INTO users (id, username, password_hash, role, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", ["user-1", "admin", "hash", "admin", 1, now, now]);
    await legacy.query("INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)", ["session-1", "user-1", "a".repeat(64), now, new Date(Date.now() + 60_000).toISOString(), now]);
    await legacy.destroy();

    const config: Config = {
      port: 3000,
      databaseUrl: `sqlite:${database}`,
      sessionSecret: "migration-test-secret-with-at-least-32-characters",
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
      allowedRedirects: [],
      trustedProxies: ["loopback"],
      loginStateTtlMs: 600_000,
      authorizationCodeTtlMs: 60_000,
      callbackPath: "/_forwardauth/callback",
      logLevel: "error",
    };
    const upgraded = createDataSource(config);
    await upgraded.initialize();
    const sessions = await upgraded.query("SELECT id, application_id, parent_session_id FROM sessions");
    const authorizationCodes = await upgraded.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'authorization_codes'");
    await upgraded.destroy();

    expect(sessions).toEqual([{ id: "session-1", application_id: null, parent_session_id: null }]);
    expect(authorizationCodes).toEqual([{ name: "authorization_codes" }]);
  });
});
