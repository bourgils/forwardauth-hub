import type { CookieOptions, Request, RequestHandler, Response } from "express";
import type { Config } from "../config.js";
import { constantTimeEqual, opaqueToken, tokenHash } from "./crypto.js";

export const CSRF_COOKIE = "coolify_auth_csrf";

function cookieOptions(config: Config): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: "/",
    maxAge: 60 * 60 * 1000,
  };
}

function sign(token: string, config: Config): string {
  return `${token}.${tokenHash(`csrf:${token}`, config.sessionSecret)}`;
}

function validSignedToken(value: unknown, config: Config): value is string {
  if (typeof value !== "string" || value.length > 256) return false;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return false;
  const token = value.slice(0, separator);
  return constantTimeEqual(value, sign(token, config));
}

export function issueCsrfToken(req: Request, res: Response, config: Config): string {
  const existing = req.cookies?.[CSRF_COOKIE] as unknown;
  if (validSignedToken(existing, config)) return existing;
  const value = sign(opaqueToken(), config);
  res.cookie(CSRF_COOKIE, value, cookieOptions(config));
  return value;
}

export function csrfProtection(config: Config): RequestHandler {
  return (req, res, next) => {
    const cookie = req.cookies?.[CSRF_COOKIE] as unknown;
    const submitted = req.get("x-csrf-token") ?? req.body?._csrf;
    if (!validSignedToken(cookie, config) || typeof submitted !== "string" || !constantTimeEqual(cookie, submitted)) {
      res.status(403).json({ error: "invalid_csrf_token" });
      return;
    }
    next();
  };
}
