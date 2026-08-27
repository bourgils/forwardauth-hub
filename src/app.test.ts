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
import { Logger } from "./logger.js";
import { createApp } from "./app.js";

const password = "correct horse battery staple";
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "coolify-auth-test-"));
const config: Config = {
  port: 3000,
  databaseUrl: `sqlite:${path.join(tempDirectory, "auth.db")}`,
  sessionSecret: "test-session-secret-with-at-least-32-characters",
  sessionTtlMs: 86_400_000,
  cookieName: "coolify_auth",
  cookieSecure: false,
  cookieSameSite: "lax",
  signupEnabled: false,
  adminUiEnabled: true,
  publicUrl: "https://auth.example.com",
  bootstrapAdminUsername: "admin",
  bootstrapAdminPassword: password,
  allowedRedirects: ["jellyfin.example.com"],
  trustedProxies: ["loopback", "linklocal", "uniquelocal"],
  loginStateTtlMs: 600_000,
  logLevel: "error",
};

async function sessionCsrf(agent: SuperAgentTest): Promise<string> {
  const response = await agent.get("/api/auth/session").expect(401);
  return response.body.csrfToken as string;
}

async function signIn(agent: SuperAgentTest): Promise<void> {
  const csrfToken = await sessionCsrf(agent);
  await agent.post("/api/auth/login").set("X-CSRF-Token", csrfToken).send({ username: "admin", password }).expect(200).expect(({ body }) => {
    expect(body.redirectTo).toBe("/admin");
    expect(body.user.username).toBe("admin");
  });
}

describe("forwardauth-hub", () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let agent: SuperAgentTest;

  beforeAll(async () => {
    dataSource = createDataSource(config);
    await dataSource.initialize();
    await bootstrapDatabase(dataSource, config, new Logger("error"));
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

  it("consumes state after login and restores the exact original URL", async () => {
    const stateAgent = request.agent(app);
    const verification = await stateAgent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/movies/123?tab=details&sort=desc")
      .set("X-Forwarded-Method", "GET")
      .set("Accept", "text/html")
      .expect(302);
    const loginUrl = new URL(verification.headers.location);
    const state = loginUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    const csrfToken = await sessionCsrf(stateAgent);
    await stateAgent.post("/api/auth/login").set("X-CSRF-Token", csrfToken).send({
      username: "admin",
      password,
      state,
    }).expect(200).expect(({ body }) => expect(body.redirectTo).toBe("https://jellyfin.example.com/movies/123?tab=details&sort=desc"));
  });

  it("authenticates, enforces default deny, grants access, and emits identity headers", async () => {
    await signIn(agent);
    const sessionResponse = await agent.get("/api/auth/session").expect(200);
    const csrfToken = sessionResponse.body.csrfToken as string;
    const userId = sessionResponse.body.user.id as string;

    await agent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/")
      .expect(403);

    const applications = await agent.get("/api/admin/applications").expect(200);
    const applicationId = applications.body.items[0].id as string;

    await agent.put(`/api/admin/applications/${applicationId}/access/${userId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ allowed: true })
      .expect(200, { allowed: true });

    const authorized = await agent.get("/api/auth/verify")
      .set("X-Forwarded-Host", "jellyfin.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/movies/123")
      .expect(200);
    expect(authorized.headers["x-auth-user"]).toBe("admin");
    expect(authorized.headers["x-auth-user-id"]).toBe(userId);
    expect(authorized.headers["x-auth-role"]).toBe("admin");

    const availableApplications = await agent.get("/api/auth/applications").expect(200);
    expect(availableApplications.body.items).toEqual([{ id: applicationId, name: "jellyfin.example.com", hostname: "jellyfin.example.com" }]);
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
