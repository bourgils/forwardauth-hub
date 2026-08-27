import { Router } from "express";
import type { DataSource } from "typeorm";
import type { Config } from "../config.js";
import { asyncHandler } from "../http.js";
import { AuditService } from "../audit/service.js";
import { ApplicationService } from "../applications/service.js";
import { PermissionService } from "../permissions/service.js";
import { SessionService } from "../sessions/service.js";
import { authBaseUrl, readForwardedRequest } from "./proxy.js";
import { LoginStateService } from "./login-states.js";

export function forwardAuthRouter(dataSource: DataSource, config: Config): Router {
  const router = Router();
  const sessions = new SessionService(dataSource, config);
  const applications = new ApplicationService(dataSource);
  const permissions = new PermissionService(dataSource);
  const states = new LoginStateService(dataSource, config);
  const audit = new AuditService(dataSource);

  router.get("/verify", asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const forwarded = readForwardedRequest(req, config);
    if (!forwarded) {
      res.status(400).json({ error: "invalid_forwarded_request" });
      return;
    }

    const application = await applications.findEnabledByHostname(forwarded.hostname);
    if (!application) {
      res.status(403).end();
      return;
    }

    const session = await sessions.find(req, true);
    if (!session) {
      if (forwarded.wantsHtml) {
        const state = await states.create(forwarded.returnTo);
        res.redirect(302, `${authBaseUrl(req, config)}/login?state=${encodeURIComponent(state)}`);
      } else {
        res.status(401).end();
      }
      return;
    }

    if (!session.user.enabled) {
      await audit.write({ action: "access_denied", userId: session.user.id, applicationId: application.id, ip: req.ip, metadata: { reason: "disabled_user" } });
      res.status(403).end();
      return;
    }

    if (!await permissions.isAllowed(session.user.id, application.id)) {
      await audit.write({ action: "access_denied", userId: session.user.id, applicationId: application.id, ip: req.ip, metadata: { reason: "permission_denied" } });
      res.status(403).end();
      return;
    }

    res.set("X-Auth-User", session.user.username);
    res.set("X-Auth-User-Id", session.user.id);
    if (session.user.email) res.set("X-Auth-Email", session.user.email);
    res.set("X-Auth-Role", session.user.role);
    res.status(200).end();
  }));

  return router;
}
