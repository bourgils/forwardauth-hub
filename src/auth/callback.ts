import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { DataSource } from "typeorm";
import type { Config } from "../config.js";
import { asyncHandler } from "../http.js";
import { AuditService } from "../audit/service.js";
import { SessionService } from "../sessions/service.js";
import { forwardedHostname } from "../applications/hostnames.js";
import { trustedProxy } from "./proxy.js";
import { AuthorizationCodeService } from "./authorization-codes.js";

export function callbackRouter(dataSource: DataSource, config: Config): Router {
  const router = Router();
  const codes = new AuthorizationCodeService(dataSource, config);
  const sessions = new SessionService(dataSource, config);
  const audit = new AuditService(dataSource);
  const callbackLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: "rate_limited" }),
  });

  function rejectCallback(req: Request, res: Response): void {
    if (config.publicUrl && req.accepts("html")) {
      const errorUrl = new URL("/auth/error", config.publicUrl);
      errorUrl.searchParams.set("reason", "invalid_authorization_code");
      res.redirect(303, errorUrl.toString());
      return;
    }
    res.status(400).json({ error: "invalid_authorization_code" });
  }

  router.get(config.callbackPath, callbackLimiter, asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (config.ssoMode !== "cross-domain") {
      res.status(404).end();
      return;
    }
    if (!trustedProxy(config)(req)) {
      res.status(400).json({ error: "untrusted_proxy" });
      return;
    }
    if (config.cookieSecure && req.protocol !== "https") {
      res.status(400).json({ error: "https_required" });
      return;
    }
    const hostname = forwardedHostname(req.get("x-forwarded-host"));
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!hostname || !code) {
      res.status(400).json({ error: "invalid_authorization_callback" });
      return;
    }
    const exchange = await codes.consume(code, hostname);
    if (!exchange) {
      await audit.write({ action: "authorization_code_rejected", ip: req.ip, metadata: { hostname } });
      rejectCallback(req, res);
      return;
    }

    await sessions.createApplication(exchange.central.user, exchange.central.session, exchange.application, req, res);
    await audit.write({ action: "authorization_code_consumed", userId: exchange.central.user.id, applicationId: exchange.application.id, ip: req.ip });
    res.redirect(303, exchange.returnTo);
  }));

  return router;
}
