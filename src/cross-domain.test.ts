import "reflect-metadata";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request, { type Response, type SuperAgentTest } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import type { Config } from "./config.js";
import { createDataSource } from "./database/data-source.js";
import { bootstrapDatabase } from "./database/bootstrap.js";
import { AuthorizationCodeEntity, SessionEntity } from "./database/entities.js";
import { Logger } from "./logger.js";
import { createApp } from "./app.js";

const password = "correct horse battery staple";
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "forwardauth-cross-domain-test-"));
const config: Config = {
  port: 3000,
  databaseUrl: `sqlite:${path.join(tempDirectory, "auth.db")}`,
  sessionSecret: "cross-domain-secret-with-at-least-32-characters",
  sessionTtlMs: 86_400_000,
  ssoMode: "cross-domain",
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

function cookie(response: Response, name: string): string {
  const values = response.headers["set-cookie"] as unknown as string[] | undefined;
  const value = values?.find((entry) => entry.startsWith(`${name}=`));
  if (!value) throw new Error(`Missing ${name} cookie`);
  return value.split(";", 1)[0]!;
}

async function stateFor(app: ReturnType<typeof createApp>, hostname: string, uri = "/private"): Promise<string> {
  const response = await request(app).get("/api/auth/verify")
    .set("X-Forwarded-Host", hostname)
    .set("X-Forwarded-Proto", "https")
    .set("X-Forwarded-Uri", uri)
    .set("X-Forwarded-Method", "GET")
    .set("Accept", "text/html")
    .expect(302);
  const state = new URL(response.headers.location).searchParams.get("state");
  if (!state) throw new Error("Missing login state");
  return state;
}

describe("cross-domain SSO", () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;
  let centralAgent: SuperAgentTest;
  let csrfToken: string;

  beforeAll(async () => {
    dataSource = createDataSource(config);
    await dataSource.initialize();
    await bootstrapDatabase(dataSource, config, new Logger("error"));
    app = createApp(dataSource, config, new Logger("error"));
    centralAgent = request.agent(app);

    const anonymous = await centralAgent.get("/api/auth/session").expect(401);
    csrfToken = anonymous.body.csrfToken as string;
    await centralAgent.post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ username: "admin", password })
      .expect(200);
    const centralSession = await centralAgent.get("/api/auth/session").expect(200);
    csrfToken = centralSession.body.csrfToken as string;
    for (const hostname of ["app.example.com", "app.other.test"]) {
      await centralAgent.post("/api/admin/applications")
        .set("X-CSRF-Token", csrfToken)
        .send({ name: hostname, hostname, enabled: true })
        .expect(201);
    }
  });

  afterAll(async () => {
    await dataSource.destroy();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it("uses one central login to issue hostname-bound sessions on independent domains", async () => {
    const firstState = await stateFor(app, "app.example.com", "/reports?period=week");
    const firstContinuation = await centralAgent.post("/api/auth/continue")
      .set("X-CSRF-Token", csrfToken)
      .send({ state: firstState })
      .expect(200);
    const firstCallback = new URL(firstContinuation.body.redirectTo as string);
    expect(firstCallback.origin).toBe("https://app.example.com");
    expect(firstCallback.pathname).toBe(config.callbackPath);

    const firstExchange = await request(app).get(`${firstCallback.pathname}${firstCallback.search}`)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .expect(303)
      .expect("Location", "https://app.example.com/reports?period=week");
    const firstCookie = cookie(firstExchange, config.applicationCookieName);
    expect(String(firstExchange.headers["set-cookie"])).not.toContain("Domain=");
    expect(String(firstExchange.headers["set-cookie"])).toContain("HttpOnly");
    expect(String(firstExchange.headers["set-cookie"])).toContain("SameSite=Lax");

    await request(app).get("/api/auth/verify")
      .set("Cookie", firstCookie)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/reports")
      .expect(200)
      .expect("X-Auth-User", "admin");

    await request(app).get("/api/auth/verify")
      .set("Cookie", firstCookie)
      .set("X-Forwarded-Host", "app.other.test")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/")
      .expect(401);

    await request(app).get(`${firstCallback.pathname}${firstCallback.search}`)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("Accept", "application/json")
      .expect(400, { error: "invalid_authorization_code" });
    await request(app).get(`${config.callbackPath}?code=${"a".repeat(43)}`)
      .set("Cookie", firstCookie)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("Accept", "text/html")
      .expect(303)
      .expect("Location", "https://auth.example.com/auth/error?reason=invalid_authorization_code");
    await request(app).get("/api/auth/verify")
      .set("Cookie", firstCookie)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/reports")
      .expect(200);

    const secondState = await stateFor(app, "app.other.test", "/dashboard");
    const secondContinuation = await centralAgent.post("/api/auth/continue")
      .set("X-CSRF-Token", csrfToken)
      .send({ state: secondState })
      .expect(200);
    const secondCallback = new URL(secondContinuation.body.redirectTo as string);
    expect(secondCallback.origin).toBe("https://app.other.test");
    const secondExchange = await request(app).get(`${secondCallback.pathname}${secondCallback.search}`)
      .set("X-Forwarded-Host", "app.other.test")
      .set("X-Forwarded-Proto", "https")
      .expect(303);
    const secondCookie = cookie(secondExchange, config.applicationCookieName);

    await request(app).get("/api/auth/verify")
      .set("Cookie", secondCookie)
      .set("X-Forwarded-Host", "app.other.test")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/dashboard")
      .expect(200);

    const mismatchedState = await stateFor(app, "app.example.com");
    const mismatchedContinuation = await centralAgent.post("/api/auth/continue")
      .set("X-CSRF-Token", csrfToken)
      .send({ state: mismatchedState })
      .expect(200);
    const mismatchedCallback = new URL(mismatchedContinuation.body.redirectTo as string);
    await request(app).get(`${mismatchedCallback.pathname}${mismatchedCallback.search}`)
      .set("X-Forwarded-Host", "app.other.test")
      .set("X-Forwarded-Proto", "https")
      .set("Accept", "application/json")
      .expect(400, { error: "invalid_authorization_code" });
    await request(app).get(`${mismatchedCallback.pathname}${mismatchedCallback.search}`)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("Accept", "application/json")
      .expect(400, { error: "invalid_authorization_code" });

    const expiredState = await stateFor(app, "app.example.com", "/expired");
    const expiredContinuation = await centralAgent.post("/api/auth/continue")
      .set("X-CSRF-Token", csrfToken)
      .send({ state: expiredState })
      .expect(200);
    const expiredCallback = new URL(expiredContinuation.body.redirectTo as string);
    await dataSource.getRepository(AuthorizationCodeEntity).createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(0) })
      .where("consumed_at IS NULL")
      .execute();
    await request(app).get(`${expiredCallback.pathname}${expiredCallback.search}`)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("Accept", "application/json")
      .expect(400, { error: "invalid_authorization_code" });

    await centralAgent.post("/api/auth/logout").set("X-CSRF-Token", csrfToken).expect(200, { loggedOut: true });
    expect(await dataSource.getRepository(SessionEntity).count()).toBe(0);
    await request(app).get("/api/auth/verify")
      .set("Cookie", firstCookie)
      .set("X-Forwarded-Host", "app.example.com")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Uri", "/")
      .expect(401);
  });
});
