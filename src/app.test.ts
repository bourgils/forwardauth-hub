import "reflect-metadata";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request, { type SuperAgentTest } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import type { Config } from "./config.js";
import { createDataSource } from "./database/data-source.js";
import { bootstrapDatabase } from "./database/bootstrap.js";
import { ApplicationEntity } from "./database/entities.js";
import { Logger } from "./logger.js";
import { createApp } from "./app.js";

const password = "correct horse battery staple";
const friendPassword = "friends password is long enough";
const applicationId = "00000000-0000-4000-8000-000000000001";
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "forwardauth-hub-test-"));
const config: Config = {
  appName: "Test Hub",
  port: 3000,
  databaseUrl: `sqlite:${path.join(tempDirectory, "auth.db")}`,
  sessionSecret: "test-session-secret-with-at-least-32-characters",
  sessionTtlMs: 86_400_000,
  ssoMode: "single-domain",
  cookieName: "coolify_auth",
  ssoCookieName: "forwardauth_sso",
  applicationCookieName: "forwardauth_app",
  cookieSecure: false,
  cookieSameSite: "lax",
  signupEnabled: false,
  adminUiEnabled: true,
  publicUrl: "https://auth.example.com",
  bootstrapAdminUsername: "admin",
  bootstrapAdminPassword: password,
  trustedProxies: ["loopback", "linklocal", "uniquelocal"],
  loginStateTtlMs: 600_000,
  authorizationCodeTtlMs: 60_000,
  callbackPath: "/_forwardauth/callback",
  logLevel: "error",
};

async function sessionCsrf(agent: SuperAgentTest): Promise<string> {
  const response = await agent.get("/api/auth/session").expect(401);
  return response.body.csrfToken as string;
}

async function signIn(agent: SuperAgentTest, username = "admin", userPassword = password): Promise<void> {
  const csrfToken = await sessionCsrf(agent);
  await agent.post("/api/auth/login").set("X-CSRF-Token", csrfToken).send({ username, password: userPassword }).expect(200);
}

describe("forwardauth-hub", () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let agent: SuperAgentTest;

  beforeAll(async () => {
    dataSource = createDataSource(config);
    await dataSource.initialize();
    await bootstrapDatabase(dataSource, config, new Logger("error"));
    const now = new Date();
    await dataSource.getRepository(ApplicationEntity).insert({ id: applicationId, name: "Jellyfin", hostname: "jellyfin.example.com", enabled: true, createdAt: now, updatedAt: now });
    app = createApp(dataSource, config, new Logger("error"));
    agent = request.agent(app);
  });

  afterAll(async () => {
    await dataSource.destroy();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("reports liveness and database readiness", async () => {
    await request(app).get("/health").expect(200, { status: "ok" });
    await request(app).get("/ready").expect(200, { status: "ok" });
  });

  it("rejects unknown applications before authentication", async () => {
    await request(app).get("/api/auth/verify")
      .set("X-Forwarded-Host", "unknown.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/")
      .expect(403);
  });

  it("redirects HTML navigation with opaque state and returns 401 for API and WebSocket requests", async () => {
    const navigation = await request(app).get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/movies/123?tab=details")
      .set("X-Forwarded-Method", "GET")
      .set("Accept", "text/html")
      .expect(302);
    expect(navigation.headers.location).toMatch(/^https:\/\/auth\.example\.com\/login\?state=[A-Za-z0-9_-]+$/);
    expect(navigation.headers.location).not.toContain("jellyfin.example.com");

    await request(app).get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/api/items")
      .set("Accept", "application/json")
      .expect(401);

    await request(app).get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/socket")
      .set("Accept", "text/html")
      .set("Upgrade", "websocket")
      .set("Connection", "Upgrade")
      .expect(401);
  });

  it("consumes state after admin login and restores the exact original URL", async () => {
    const stateAgent = request.agent(app);
    const verification = await stateAgent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/movies/123?tab=details&sort=desc")
      .set("X-Forwarded-Method", "GET")
      .set("Accept", "text/html")
      .expect(302);
    const state = new URL(verification.headers.location).searchParams.get("state");
    expect(state).toBeTruthy();
    const csrfToken = await sessionCsrf(stateAgent);
    await stateAgent.post("/api/auth/login").set("X-CSRF-Token", csrfToken).send({ username: "admin", password, state }).expect(200).expect(({ body }) => {
      expect(body.redirectTo).toBe("https://jellyfin.example.com/movies/123?tab=details&sort=desc");
    });
  });

  it("gives administrators implicit access and records successful activity", async () => {
    await signIn(agent);
    const sessionResponse = await agent.get("/api/auth/session").expect(200);
    expect(sessionResponse.body.settings.appName).toBe("Test Hub");
    const userId = sessionResponse.body.user.id as string;
    const authorized = await agent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/movies/123")
      .expect(200);
    expect(authorized.headers["x-auth-user"]).toBe("admin");
    expect(authorized.headers["x-auth-user-id"]).toBe(userId);
    expect(authorized.headers["x-auth-role"]).toBe("admin");

    const availableApplications = await agent.get("/api/auth/applications").expect(200);
    expect(availableApplications.body.items).toEqual([{ id: applicationId, name: "Jellyfin", hostname: "jellyfin.example.com" }]);
    const activity = await agent.get("/api/admin/activity").expect(200);
    expect(activity.body.items[0]).toMatchObject({ userId, applicationId, accessCount: 1 });
  });

  it("enforces group permissions and user validity windows", async () => {
    const csrfToken = (await agent.get("/api/auth/session").expect(200)).body.csrfToken as string;
    const group = await agent.post("/api/admin/groups")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Friends", description: "Friends and family", enabled: true })
      .expect(201);
    const user = await agent.post("/api/admin/users")
      .set("X-CSRF-Token", csrfToken)
      .send({ username: "friend", password: friendPassword, role: "user", enabled: true, groupIds: [group.body.id] })
      .expect(201);

    const friendAgent = request.agent(app);
    await signIn(friendAgent, "friend", friendPassword);
    await friendAgent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/")
      .expect(403);

    await agent.put(`/api/admin/groups/${group.body.id}/applications/${applicationId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ allowed: true })
      .expect(200, { allowed: true });
    await friendAgent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/")
      .expect(200)
      .expect("X-Auth-User", "friend");
    expect((await friendAgent.get("/api/auth/applications").expect(200)).body.items).toHaveLength(1);

    await agent.put(`/api/admin/groups/${group.body.id}/applications/${applicationId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ allowed: false })
      .expect(200, { allowed: false });
    await friendAgent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/")
      .expect(403);

    await agent.patch(`/api/admin/users/${user.body.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ accessEndsAt: new Date(Date.now() - 1_000).toISOString() })
      .expect(200);
    await friendAgent.get("/api/auth/session").expect(401);
    const expiredAgent = request.agent(app);
    const expiredCsrfToken = await sessionCsrf(expiredAgent);
    await expiredAgent.post("/api/auth/login")
      .set("X-CSRF-Token", expiredCsrfToken)
      .send({ username: "friend", password: friendPassword })
      .expect(401);
  });

  it("reports dashboard metrics from existing authentication data", async () => {
    const dashboard = await agent.get("/api/admin/dashboard").expect(200);
    expect(dashboard.body.users).toMatchObject({ total: 2, active: 1, disabled: 0, scheduled: 0, expired: 1, withoutGroup: 0 });
    expect(dashboard.body.applications).toMatchObject({ total: 1, active: 1, withoutGroupAccess: 1 });
    expect(dashboard.body.groups).toMatchObject({ total: 1, disabled: 0 });
    expect(dashboard.body.sessions.active).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.sessions.uniqueUsers).toBe(1);
    expect(dashboard.body.security.accessDenied24h).toBeGreaterThanOrEqual(2);
    expect(dashboard.body.security.loginFailures24h).toBeGreaterThanOrEqual(1);
    expect(dashboard.body.topApplications[0]).toMatchObject({ id: applicationId, requests: 2, users: 2 });
    expect(dashboard.body.recentSecurity.map((event: { action: string }) => event.action)).toEqual(expect.arrayContaining(["access_denied", "login_failure"]));
  });

  it("protects administrative mutations with CSRF", async () => {
    await agent.post("/api/admin/applications").send({ name: "Radarr", hostname: "radarr.example.com" }).expect(403, { error: "invalid_csrf_token" });
  });

  it("returns 401 rather than an HTML redirect for an unauthenticated admin API call", async () => {
    await request(app).get("/api/admin/users").expect(401, { error: "unauthenticated" });
  });

  it("revokes the server-side session on logout", async () => {
    const sessionResponse = await agent.get("/api/auth/session").expect(200);
    await agent.post("/api/auth/logout").set("X-CSRF-Token", sessionResponse.body.csrfToken).expect(200, { loggedOut: true });
    await agent.get("/api/auth/session").expect(401).expect(({ body }) => {
      expect(body.authenticated).toBe(false);
      expect(body.csrfToken).toBeTypeOf("string");
    });
  });
});
