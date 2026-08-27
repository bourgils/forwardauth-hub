import { z } from "zod";

export type SameSite = "lax" | "strict" | "none";
export type SsoMode = "single-domain" | "cross-domain";

export interface Config {
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  sessionTtlMs: number;
  ssoMode: SsoMode;
  cookieName: string;
  ssoCookieName: string;
  applicationCookieName: string;
  cookieDomain?: string;
  cookieSecure: boolean;
  cookieSameSite: SameSite;
  signupEnabled: boolean;
  adminUiEnabled: boolean;
  publicUrl?: string;
  bootstrapAdminUsername?: string;
  bootstrapAdminPassword?: string;
  allowedRedirects: string[];
  trustedProxies: string[];
  loginStateTtlMs: number;
  authorizationCodeTtlMs: number;
  callbackPath: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

const booleanValue = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1).default("sqlite:/data/auth.db"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must contain at least 32 characters"),
  SESSION_TTL: z.string().default("30d"),
  SSO_MODE: z.enum(["single-domain", "cross-domain"]).default("single-domain"),
  COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("coolify_auth"),
  SSO_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("forwardauth_sso"),
  APPLICATION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default("forwardauth_app"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: booleanValue.default(true),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  SIGNUP_ENABLED: booleanValue.default(false),
  ADMIN_UI_ENABLED: booleanValue.default(true),
  PUBLIC_URL: z.string().url().optional(),
  BOOTSTRAP_ADMIN_USERNAME: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
  ALLOWED_REDIRECTS: z.string().default(""),
  TRUSTED_PROXIES: z.string().default("loopback,linklocal,uniquelocal"),
  LOGIN_STATE_TTL: z.string().default("10m"),
  AUTHORIZATION_CODE_TTL: z.string().default("60s"),
  CALLBACK_PATH: z.string().max(128).refine((value) => value.length > 1 && value.startsWith("/") && !value.startsWith("//") && !value.endsWith("/") && !/[?#]/.test(value), "CALLBACK_PATH must be an absolute non-root path without a trailing slash").default("/_forwardauth/callback"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export function parseDuration(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] as "ms" | "s" | "m" | "h" | "d";
  const multipliers = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const env = environmentSchema.parse(environment);
  let publicUrl: string | undefined;
  if (env.PUBLIC_URL) {
    const parsed = new URL(env.PUBLIC_URL);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error("PUBLIC_URL must contain only an HTTP(S) origin");
    }
    publicUrl = parsed.origin;
  }

  if (env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) {
    throw new Error("COOKIE_SECURE must be true when COOKIE_SAME_SITE=none");
  }
  if (env.SSO_MODE === "cross-domain" && !publicUrl) {
    throw new Error("PUBLIC_URL is required when SSO_MODE=cross-domain");
  }
  const authorizationCodeTtlMs = parseDuration(env.AUTHORIZATION_CODE_TTL);
  if (authorizationCodeTtlMs < 1_000 || authorizationCodeTtlMs > 5 * 60_000) {
    throw new Error("AUTHORIZATION_CODE_TTL must be between 1s and 5m");
  }

  return {
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
    sessionTtlMs: parseDuration(env.SESSION_TTL),
    ssoMode: env.SSO_MODE,
    cookieName: env.COOKIE_NAME,
    ssoCookieName: env.SSO_COOKIE_NAME,
    applicationCookieName: env.APPLICATION_COOKIE_NAME,
    cookieDomain: env.COOKIE_DOMAIN || undefined,
    cookieSecure: env.COOKIE_SECURE,
    cookieSameSite: env.COOKIE_SAME_SITE,
    signupEnabled: env.SIGNUP_ENABLED,
    adminUiEnabled: env.ADMIN_UI_ENABLED,
    publicUrl,
    bootstrapAdminUsername: env.BOOTSTRAP_ADMIN_USERNAME || undefined,
    bootstrapAdminPassword: env.BOOTSTRAP_ADMIN_PASSWORD || undefined,
    allowedRedirects: env.ALLOWED_REDIRECTS.split(",").map((host) => host.trim()).filter(Boolean),
    trustedProxies: env.TRUSTED_PROXIES.split(",").map((entry) => entry.trim()).filter(Boolean),
    loginStateTtlMs: parseDuration(env.LOGIN_STATE_TTL),
    authorizationCodeTtlMs,
    callbackPath: env.CALLBACK_PATH,
    logLevel: env.LOG_LEVEL,
  };
}
